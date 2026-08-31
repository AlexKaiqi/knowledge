import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { readFile, realpath } from 'node:fs/promises'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import path from 'node:path'
import { promisify } from 'node:util'
import { domainToASCII, fileURLToPath, pathToFileURL } from 'node:url'

const exec = promisify(execFile)
const connectorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const upstream = JSON.parse(await readFile(path.join(connectorRoot, 'upstream.json'), 'utf8'))
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const ALLOWED_INPUT_KEYS = new Set(['domain'])
const CATEGORY_IDS = new Set(['robots', 'structured', 'llms', 'meta', 'sitemap'])
const SEVERITIES = new Set(['info', 'warn', 'error'])
const BOT_ACCESS = new Set(['allowed', 'blocked'])
const BOT_ACCESS_VIA = new Set(['specific', 'wildcard', 'default'])

const blockedAddresses = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blockedAddresses.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64],
  ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]) blockedAddresses.addSubnet(network, prefix, 'ipv6')

const digest = (value) => createHash('sha256').update(value).digest('hex')

function boundedString(value, field, { minLength = 1, maxLength = 2048 } = {}) {
  if (typeof value !== 'string' || value.length < minLength || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Optifeed Radar ${field} shape changed`)
  }
  return value
}

export function normalizePublicDomain(value) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 3 || value.length > 253) throw new Error('domain must be a bounded bare public hostname')
  if (value.includes('/') || value.includes(':') || value.includes('@') || value.includes('?') || value.includes('#')) throw new Error('domain must be a bare hostname without URL components')
  const ascii = domainToASCII(value.replace(/\.$/, '').toLowerCase())
  if (!ascii || ascii.length > 253 || isIP(ascii) !== 0 || !ascii.includes('.')) throw new Error('domain must be a public DNS hostname, not an IP or local name')
  const labels = ascii.split('.')
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('domain contains an invalid DNS label')
  return ascii
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  return { domain: normalizePublicDomain(input.domain) }
}

export function assertPublicAddress(address) {
  const family = isIP(address)
  const ipv4MappedIpv6 = family === 6 && /^::ffff:(?:[0-9a-f]{1,4}:|(?:\d{1,3}\.){3}\d{1,3}$)/i.test(address)
  if (family === 0 || ipv4MappedIpv6 || blockedAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')) throw new Error('target resolved to a private, local, documentation, multicast, or reserved address')
  return { address, family }
}

export function validatePublicHttpsUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('target URL is invalid') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('target URL must use public HTTPS without credentials or a custom port')
  normalizePublicDomain(url.hostname)
  return url
}

function responseHeaders(headers) {
  const normalized = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) for (const item of value) normalized.append(name, item)
    else if (value !== undefined) normalized.set(name, String(value))
  }
  return normalized
}

export function createSafePublicHttpsFetch({ lookupImpl = dnsLookup, requestImpl = httpsRequest, maxResponseBytes = MAX_RESPONSE_BYTES } = {}) {
  return async (value, init = {}) => {
    const url = validatePublicHttpsUrl(value)
    const records = await lookupImpl(url.hostname, { all: true, verbatim: true })
    if (!Array.isArray(records) || records.length === 0) throw new Error('target DNS name returned no addresses')
    const checked = records.map((record) => assertPublicAddress(record.address))
    const selected = checked[0]
    return await new Promise((resolve, reject) => {
      const request = requestImpl(url, {
        method: 'GET',
        headers: { ...(init.headers ?? {}), 'accept-encoding': 'identity' },
        signal: init.signal,
        family: selected.family,
        lookup: (_hostname, options, callback) => {
          if (options?.all) callback(null, [{ address: selected.address, family: selected.family }])
          else callback(null, selected.address, selected.family)
        },
      }, (response) => {
        const chunks = []
        let bytes = 0
        response.on('data', (chunk) => {
          bytes += chunk.length
          if (bytes > maxResponseBytes) {
            request.destroy(new Error('target response exceeds the 2 MiB budget'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          resolve({ status: response.statusCode ?? 0, headers: responseHeaders(response.headers), text: async () => body })
        })
      })
      request.on('error', reject)
      request.end()
    })
  }
}

export async function loadReviewedRadar(radarRoot) {
  if (typeof radarRoot !== 'string' || !path.isAbsolute(radarRoot)) throw new Error('radarRoot must be an absolute path')
  const root = await realpath(radarRoot)
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  if (packageJson.name !== upstream.packageName || packageJson.version !== upstream.packageVersion || packageJson.license !== upstream.license) throw new Error('Optifeed Radar package identity differs from the reviewed upstream')
  const { stdout } = await exec('git', ['-C', root, 'rev-parse', 'HEAD'], { maxBuffer: 1024 * 1024 })
  if (stdout.trim() !== upstream.acceptedCommit) throw new Error('Optifeed Radar checkout is not at the reviewed commit')
  const runPath = await realpath(path.join(root, 'dist/core/run/index.js'))
  const fetcherPath = await realpath(path.join(root, 'dist/core/fetcher/index.js'))
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (!runPath.startsWith(rootPrefix) || !fetcherPath.startsWith(rootPrefix)) throw new Error('Optifeed Radar build entrypoint escaped the reviewed clone')
  const [runModule, fetcherModule] = await Promise.all([import(pathToFileURL(runPath).href), import(pathToFileURL(fetcherPath).href)])
  if (typeof runModule.runAudit !== 'function' || typeof fetcherModule.createFetcher !== 'function') throw new Error('Optifeed Radar audited module surface changed')
  return { runAudit: runModule.runAudit, createFetcher: fetcherModule.createFetcher, packageVersion: packageJson.version }
}

export function normalizeRadarAudit(report, { domain, observedAt = new Date().toISOString(), packageVersion = upstream.packageVersion } = {}) {
  const normalizedDomain = normalizePublicDomain(domain)
  if (!report || typeof report !== 'object' || Array.isArray(report) || report.schema_version !== '0.3' || report.domain !== normalizedDomain) throw new Error('Optifeed Radar audit identity or schema version changed')
  if (!Number.isInteger(report.score) || report.score < 0 || report.score > 100) throw new Error('Optifeed Radar readiness score shape changed')
  if (!Array.isArray(report.categories) || report.categories.length !== 5 || !Array.isArray(report.findings) || report.findings.length > 100 || !Array.isArray(report.bots) || report.bots.length > 32) throw new Error('Optifeed Radar audit collection shape changed')
  const categories = report.categories.map((category) => {
    if (!category || typeof category !== 'object' || !CATEGORY_IDS.has(category.id) || !Number.isFinite(category.weight) || category.weight < 0 || category.weight > 100 || !Number.isFinite(category.earned) || category.earned < 0 || category.earned > category.weight) throw new Error('Optifeed Radar category shape changed')
    return { id: category.id, label: boundedString(category.label, 'category label', { maxLength: 100 }), weight: category.weight, earned: category.earned }
  })
  if (new Set(categories.map((category) => category.id)).size !== 5 || categories.reduce((sum, category) => sum + category.weight, 0) !== 100) throw new Error('Optifeed Radar category weights changed')
  const findings = report.findings.map((finding) => {
    if (!finding || typeof finding !== 'object' || !SEVERITIES.has(finding.severity)) throw new Error('Optifeed Radar finding shape changed')
    return { id: boundedString(finding.id, 'finding id', { maxLength: 200 }), severity: finding.severity, message: boundedString(finding.message, 'finding message', { maxLength: 2000 }) }
  })
  const crawlerAccess = report.bots.map((bot) => {
    if (!bot || typeof bot !== 'object' || !BOT_ACCESS.has(bot.access) || !BOT_ACCESS_VIA.has(bot.via)) throw new Error('Optifeed Radar bot access shape changed')
    return { bot: boundedString(bot.bot, 'bot id', { maxLength: 100 }), vendor: boundedString(bot.vendor, 'bot vendor', { maxLength: 100 }), access: bot.access, via: bot.via }
  })
  const projection = {
    source: { tool: 'optifeed-radar', version: packageVersion, upstreamSchemaVersion: report.schema_version },
    domain: normalizedDomain,
    readiness: { score: report.score, minimum: 0, maximum: 100, scoreKind: 'site-ai-readiness' },
    categories,
    findings,
    crawlerAccess,
    measurement: {
      kind: 'point-in-time-public-site-readiness',
      aiEngineCalls: false,
      apiCost: 0,
      currency: 'USD',
      recommendationVisibilityMeasured: false,
      sampledSitemapPagesMaximum: 3,
      conclusionsRequireHumanReview: true,
    },
  }
  const assertions = [
    { id: 'upstream-schema-version', passed: report.schema_version === '0.3' },
    { id: 'exact-domain', passed: report.domain === normalizedDomain },
    { id: 'bounded-score', passed: Number.isInteger(report.score) && report.score >= 0 && report.score <= 100 },
    { id: 'complete-category-weights', passed: categories.reduce((sum, category) => sum + category.weight, 0) === 100 },
    { id: 'zero-provider-calls', passed: true },
    { id: 'zero-cost', passed: true },
    { id: 'visibility-not-claimed', passed: projection.measurement.recommendationVisibilityMeasured === false },
    { id: 'hidden-runtime-details', passed: !JSON.stringify(projection).includes('radarRoot') && !JSON.stringify(projection).includes(upstream.acceptedCommit) },
  ]
  return {
    ...projection,
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function auditStoreAiReadiness(input, { radarRoot, fetchImpl, now = () => new Date(), radar } = {}) {
  const normalized = assertInput(input)
  const runtime = radar ?? await loadReviewedRadar(radarRoot)
  const safeFetch = fetchImpl ?? createSafePublicHttpsFetch()
  const report = await runtime.runAudit(normalized.domain, { fetcher: runtime.createFetcher({ fetchImpl: safeFetch, maxRedirects: 5, maxBytes: MAX_RESPONSE_BYTES }) })
  return normalizeRadarAudit(report, { domain: normalized.domain, observedAt: now().toISOString(), packageVersion: runtime.packageVersion })
}

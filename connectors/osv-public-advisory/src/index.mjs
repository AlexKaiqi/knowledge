import { createHash } from 'node:crypto'

export const OSV_API_BASE_URL = 'https://api.osv.dev'
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const MAX_AFFECTED = 128
export const MAX_RANGES_PER_AFFECTED = 32
export const MAX_EVENTS_PER_RANGE = 128
export const MAX_VERSION_SAMPLE = 256
export const MAX_REFERENCES = 64
export const MAX_DETAILS_EXCERPT_CHARACTERS = 4096

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const EVENT_KEYS = ['introduced', 'fixed', 'last_affected', 'limit']
const digest = (value) => createHash('sha256').update(value).digest('hex')

export class OsvPublicAdvisoryError extends Error {
  constructor(message, { code, httpStatus, retryAt = null } = {}) {
    super(message)
    this.name = 'OsvPublicAdvisoryError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => key !== 'advisoryId')
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.advisoryId !== 'string' || !ID_PATTERN.test(input.advisoryId)) throw new Error('advisoryId must be one exact case-sensitive OSV identifier')
  return { advisoryId: input.advisoryId }
}

function optionalString(value, field, maxLength = 4096) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength || /\u0000/.test(value)) throw new Error(`OSV ${field} shape changed`)
  return value
}

function timestamp(value, field, nullable = false) {
  if (nullable && (value === undefined || value === null)) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`OSV ${field} shape changed`)
  return new Date(value).toISOString()
}

function stringSet(value, field, maxItems = 128) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 256 || /\u0000/.test(item))) throw new Error(`OSV ${field} shape changed`)
  return [...new Set(value)].sort()
}

function httpsUrl(value, field, nullable = true) {
  if (nullable && (value === undefined || value === null || value === '')) return null
  let url
  try { url = new URL(value) } catch { throw new Error(`OSV ${field} URL is invalid`) }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`OSV ${field} URL is not safe HTTPS`)
  return url.href
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('OSV range event shape changed')
  const present = EVENT_KEYS.filter((key) => Object.hasOwn(event, key))
  if (present.length !== 1 || Object.keys(event).some((key) => !EVENT_KEYS.includes(key))) throw new Error('OSV range event must contain exactly one recognized boundary')
  const value = event[present[0]]
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || /\u0000/.test(value)) throw new Error('OSV range event boundary shape changed')
  return { kind: present[0].replace('_', '-'), value }
}

function normalizeRange(range) {
  if (!range || typeof range !== 'object' || Array.isArray(range) || typeof range.type !== 'string' || range.type.length < 1 || range.type.length > 32 || !Array.isArray(range.events) || range.events.length > MAX_EVENTS_PER_RANGE) {
    throw new Error('OSV affected range shape changed')
  }
  return {
    type: range.type,
    repository: httpsUrl(range.repo, 'range repository'),
    events: range.events.map(normalizeEvent),
  }
}

function normalizeAffected(affected) {
  if (!affected || typeof affected !== 'object' || Array.isArray(affected) || !affected.package || typeof affected.package !== 'object') throw new Error('OSV affected package shape changed')
  const ecosystem = optionalString(affected.package.ecosystem, 'package ecosystem', 128)
  const name = optionalString(affected.package.name, 'package name', 512)
  if (!ecosystem || !name) throw new Error('OSV affected package identity is missing')
  const purl = optionalString(affected.package.purl, 'package purl', 1024)
  const ranges = affected.ranges ?? []
  if (!Array.isArray(ranges) || ranges.length > MAX_RANGES_PER_AFFECTED) throw new Error('OSV affected ranges exceed the bounded projection')
  const versions = stringSet(affected.versions, 'affected versions', 100_000)
  return {
    package: { ecosystem, name, purl },
    ranges: ranges.map(normalizeRange),
    versions: {
      totalCount: versions.length,
      sample: versions.slice(0, MAX_VERSION_SAMPLE),
      sampleComplete: versions.length <= MAX_VERSION_SAMPLE,
      sha256: digest(versions.join('\n')),
    },
  }
}

function normalizeSeverity(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 16) throw new Error('OSV severity shape changed')
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.type !== 'string' || typeof entry.score !== 'string' || entry.type.length > 64 || entry.score.length > 1024) throw new Error('OSV severity entry shape changed')
    return { type: entry.type, score: entry.score, source: httpsUrl(entry.source, 'severity source') }
  })
}

function normalizeReferences(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) throw new Error('OSV references exceed the bounded projection')
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.type !== 'string' || entry.type.length > 64) throw new Error('OSV reference shape changed')
    return { type: entry.type, url: httpsUrl(entry.url, 'reference', false) }
  }).sort((left, right) => left.type.localeCompare(right.type) || left.url.localeCompare(right.url))
}

function normalizeDetails(value) {
  if (value === undefined || value === null || value === '') return { characterCount: 0, sha256: null, excerpt: null, truncated: false }
  if (typeof value !== 'string' || /\u0000/.test(value)) throw new Error('OSV details shape changed')
  const characters = [...value]
  return { characterCount: characters.length, sha256: digest(value), excerpt: characters.slice(0, MAX_DETAILS_EXCERPT_CHARACTERS).join(''), truncated: characters.length > MAX_DETAILS_EXCERPT_CHARACTERS }
}

function retryAt(headers, now) {
  const value = headers.get('retry-after')
  if (value !== null && /^\d+$/.test(value)) return new Date(now.getTime() + Number(value) * 1000).toISOString()
  if (value !== null && Number.isFinite(Date.parse(value))) return new Date(value).toISOString()
  return null
}

async function readJson(response) {
  const type = response.headers.get('content-type') ?? ''
  if (!type.toLowerCase().includes('application/json')) throw new Error(`OSV advisory read returned ${type || 'no content type'}`)
  const length = response.headers.get('content-length')
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) throw new Error('OSV advisory response exceeds the 2 MiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('OSV advisory response has no body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('OSV advisory response exceeds the 2 MiB budget') }
    source += decoder.decode(value, { stream: true })
  }
  try { source += decoder.decode() } catch { throw new Error('OSV advisory response is not valid UTF-8') }
  try { return JSON.parse(source) } catch { throw new Error('OSV advisory response is not valid JSON') }
}

export function normalizePublicAdvisoryResponse(payload, { input, observedAt = new Date().toISOString() } = {}) {
  const normalizedInput = assertInput(input)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.id !== normalizedInput.advisoryId || typeof payload.schema_version !== 'string' || !Array.isArray(payload.affected) || payload.affected.length > MAX_AFFECTED) {
    throw new Error('OSV advisory identity or bounded shape changed')
  }
  const projection = {
    source: { id: 'osv-public-advisory', apiBaseUrl: OSV_API_BASE_URL, endpointTemplate: `${OSV_API_BASE_URL}/v1/vulns/{id}` },
    request: normalizedInput,
    advisory: {
      id: payload.id,
      schemaVersion: payload.schema_version,
      modifiedAt: timestamp(payload.modified, 'modified'),
      publishedAt: timestamp(payload.published, 'published', true),
      withdrawnAt: timestamp(payload.withdrawn, 'withdrawn', true),
      aliases: stringSet(payload.aliases, 'aliases'),
      upstream: stringSet(payload.upstream, 'upstream'),
      related: stringSet(payload.related, 'related'),
      summary: optionalString(payload.summary, 'summary', 2048),
      details: normalizeDetails(payload.details),
      severity: normalizeSeverity(payload.severity),
      affected: payload.affected.map(normalizeAffected),
      references: normalizeReferences(payload.references),
    },
  }
  const assertions = [
    { id: 'exact-advisory-id', passed: true },
    { id: 'bounded-affected-records', passed: projection.advisory.affected.length <= MAX_AFFECTED },
    { id: 'version-coverage-declared', passed: projection.advisory.affected.every((entry) => entry.versions.sampleComplete === (entry.versions.totalCount <= MAX_VERSION_SAMPLE)) },
    { id: 'personal-credits-excluded', passed: !JSON.stringify(projection).includes('"credits"') },
    { id: 'database-specific-excluded', passed: !JSON.stringify(projection).includes('database_specific') && !JSON.stringify(projection).includes('ecosystem_specific') },
  ]
  return { ...projection, observedAt, resultDigest: digest(JSON.stringify(projection)), conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } }
}

export async function readPublicAdvisory(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  const url = new URL(`/v1/vulns/${encodeURIComponent(normalizedInput.advisoryId)}`, OSV_API_BASE_URL)
  const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', 'user-agent': userAgent }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) {
    const code = response.status === 429 ? 'rate-limited' : response.status === 404 ? 'advisory-not-found' : `http-${response.status}`
    throw new OsvPublicAdvisoryError(`OSV advisory read failed: HTTP_${response.status}`, { code, httpStatus: response.status, retryAt: retryAt(response.headers, now()) })
  }
  return normalizePublicAdvisoryResponse(await readJson(response), { input: normalizedInput, observedAt: now().toISOString() })
}

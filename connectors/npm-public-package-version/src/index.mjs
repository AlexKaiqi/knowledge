import { createHash } from 'node:crypto'

export const REGISTRY_BASE_URL = 'https://registry.npmjs.org'
export const MAX_RESPONSE_BYTES = 1024 * 1024

const ALLOWED_INPUT_KEYS = new Set(['packageName', 'version'])
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9](?:[a-z0-9._~-]{0,99})\/[a-z0-9](?:[a-z0-9._~-]{0,99})|[a-z0-9](?:[a-z0-9._~-]{0,213}))$/
const EXACT_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const SRI_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/
const SHA1_PATTERN = /^[a-f0-9]{40}$/

export class NpmPublicPackageVersionError extends Error {
  constructor(message, { code, httpStatus, retryAfter = null, retryAt = null } = {}) {
    super(message)
    this.name = 'NpmPublicPackageVersionError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAfter = retryAfter
    this.retryAt = retryAt
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex')

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.packageName !== 'string' || !PACKAGE_NAME_PATTERN.test(input.packageName)) throw new Error('packageName must be a lowercase npm package name')
  if (typeof input.version !== 'string' || input.version.length > 128 || !EXACT_VERSION_PATTERN.test(input.version)) throw new Error('version must be an exact semantic version')
  return { packageName: input.packageName, version: input.version }
}

function optionalString(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`npm package ${field} shape changed`)
  return value
}

function normalizeRepository(repository) {
  if (repository === undefined || repository === null) return null
  if (typeof repository === 'string') return { type: null, url: repository, directory: null }
  if (!repository || typeof repository !== 'object' || Array.isArray(repository)) throw new Error('npm package repository shape changed')
  const url = optionalString(repository.url, 'repository.url')
  if (!url) return null
  return {
    type: optionalString(repository.type, 'repository.type'),
    url,
    directory: optionalString(repository.directory, 'repository.directory'),
  }
}

function normalizeEngines(engines) {
  if (engines === undefined || engines === null) return {}
  if (!engines || typeof engines !== 'object' || Array.isArray(engines)) throw new Error('npm package engines shape changed')
  const entries = Object.entries(engines)
  if (entries.some(([name, constraint]) => !name || typeof constraint !== 'string')) throw new Error('npm package engines shape changed')
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
}

function assertTarballUrl(value, packageName, version) {
  if (typeof value !== 'string') throw new Error('npm package tarball URL is missing')
  let url
  try { url = new URL(value) } catch { throw new Error('npm package tarball URL is invalid') }
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password || url.search || url.hash) throw new Error('npm package tarball URL escaped the public registry')
  const leafName = packageName.includes('/') ? packageName.slice(packageName.indexOf('/') + 1) : packageName
  if (!decodeURIComponent(url.pathname).endsWith(`/${leafName}-${version}.tgz`)) throw new Error('npm package tarball URL does not match the requested package version')
  return url.href
}

function assertPayload(payload, input) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.name !== input.packageName || payload.version !== input.version) throw new Error('npm package response identity changed')
  if (!payload.dist || typeof payload.dist !== 'object' || !SRI_PATTERN.test(payload.dist.integrity) || !SHA1_PATTERN.test(payload.dist.shasum)) throw new Error('npm package distribution integrity metadata is missing or malformed')
}

export function normalizePublicPackageVersionResponse(payload, { input, observedAt = new Date().toISOString() }) {
  const normalizedInput = assertInput(input)
  assertPayload(payload, normalizedInput)
  const tarballUrl = assertTarballUrl(payload.dist.tarball, normalizedInput.packageName, normalizedInput.version)
  const projection = {
    source: { id: 'npm-public-package-version', registry: REGISTRY_BASE_URL },
    request: normalizedInput,
    packageVersion: {
      name: payload.name,
      version: payload.version,
      description: optionalString(payload.description, 'description'),
      license: optionalString(payload.license, 'license'),
      deprecated: optionalString(payload.deprecated, 'deprecated'),
      repository: normalizeRepository(payload.repository),
      engines: normalizeEngines(payload.engines),
      distribution: {
        integrity: payload.dist.integrity,
        shasum: payload.dist.shasum,
        tarballUrl,
      },
    },
  }
  const assertions = [
    { id: 'exact-package-version', passed: true },
    { id: 'distribution-integrity', passed: true },
    { id: 'registry-tarball-origin', passed: true },
    { id: 'personal-fields-excluded', passed: !Object.hasOwn(projection.packageVersion, 'maintainers') && !Object.hasOwn(projection.packageVersion, 'contributors') && !Object.hasOwn(projection.packageVersion, 'author') },
  ]
  return {
    ...projection,
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicPackageVersion(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  const url = new URL(`/${encodeURIComponent(normalizedInput.packageName)}/${encodeURIComponent(normalizedInput.version)}`, REGISTRY_BASE_URL)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': userAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after')
    let retryAt = null
    if (retryAfter !== null) {
      if (/^\d+$/.test(retryAfter)) retryAt = new Date(now().getTime() + Number(retryAfter) * 1000).toISOString()
      else if (Number.isFinite(Date.parse(retryAfter))) retryAt = new Date(retryAfter).toISOString()
    }
    throw new NpmPublicPackageVersionError(
      `npm public package version read failed: HTTP_${response.status}; retryAfter=${retryAfter ?? 'unknown'}`,
      { code: response.status === 429 ? 'rate-limited' : `http-${response.status}`, httpStatus: response.status, retryAfter, retryAt },
    )
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`npm public package version read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('npm public package version response exceeds the 1 MiB budget')
  const source = await response.text()
  if (Buffer.byteLength(source) > MAX_RESPONSE_BYTES) throw new Error('npm public package version response exceeds the 1 MiB budget')
  let payload
  try { payload = JSON.parse(source) } catch { throw new Error('npm public package version response is not valid JSON') }
  return normalizePublicPackageVersionResponse(payload, { input: normalizedInput, observedAt: now().toISOString() })
}

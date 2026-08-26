import { createHash } from 'node:crypto'

export const PYPI_BASE_URL = 'https://pypi.org'
export const FILES_HOST = 'files.pythonhosted.org'
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const MAX_DISTRIBUTIONS = 64

const ALLOWED_INPUT_KEYS = new Set(['projectName', 'version'])
const NORMALIZED_PROJECT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NORMALIZED_VERSION_PATTERN = /^(?:[0-9]+!)?[0-9]+(?:\.[0-9]+)*(?:(?:a|b|rc)[0-9]+)?(?:\.post[0-9]+)?(?:\.dev[0-9]+)?(?:\+[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/
const HEX_64 = /^[a-f0-9]{64}$/
const PROJECT_URL_LIMIT = 12
const USEFUL_PROJECT_URL_LABELS = new Set(['source', 'repository', 'homepage', 'documentation', 'docs', 'bug reports', 'issues', 'changelog', 'release notes'])

const digest = (value) => createHash('sha256').update(value).digest('hex')
const normalizeProjectName = (value) => value.toLowerCase().replace(/[-_.]+/g, '-')

export class PyPIPublicProjectReleaseError extends Error {
  constructor(message, { code, httpStatus, retryAfter = null, retryAt = null } = {}) {
    super(message)
    this.name = 'PyPIPublicProjectReleaseError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAfter = retryAfter
    this.retryAt = retryAt
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.projectName !== 'string' || input.projectName.length > 200 || !NORMALIZED_PROJECT_PATTERN.test(input.projectName)) throw new Error('projectName must be a normalized lowercase PyPI project name')
  if (typeof input.version !== 'string' || input.version.length > 128 || !NORMALIZED_VERSION_PATTERN.test(input.version)) throw new Error('version must be an exact normalized Python package version')
  return { projectName: input.projectName, version: input.version }
}

function optionalString(value, field, { maxLength = 4096 } = {}) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`PyPI ${field} shape changed`)
  return value
}

function normalizeProjectUrls(projectUrls) {
  if (projectUrls === undefined || projectUrls === null) return []
  if (!projectUrls || typeof projectUrls !== 'object' || Array.isArray(projectUrls)) throw new Error('PyPI project_urls shape changed')
  const entries = Object.entries(projectUrls).filter(([label]) => USEFUL_PROJECT_URL_LABELS.has(label.trim().toLowerCase()))
  if (entries.length > PROJECT_URL_LIMIT) throw new Error('PyPI project_urls exceeds the bounded projection')
  return entries.flatMap(([label, value]) => {
    if (!label || label.length > 80 || typeof value !== 'string') throw new Error('PyPI project_urls shape changed')
    let url
    try { url = new URL(value) } catch { throw new Error('PyPI project URL is invalid') }
    if (url.protocol !== 'https:' || url.username || url.password) return []
    return [{ label, url: url.href }]
  }).sort((left, right) => left.label.localeCompare(right.label) || left.url.localeCompare(right.url))
}

function normalizeLicenseClassifiers(classifiers) {
  if (classifiers === undefined || classifiers === null) return []
  if (!Array.isArray(classifiers) || classifiers.some((value) => typeof value !== 'string')) throw new Error('PyPI classifiers shape changed')
  return [...new Set(classifiers.filter((value) => value.startsWith('License :: ')))].sort()
}

function coreMetadataSha256(file) {
  const value = file['core-metadata'] ?? file.core_metadata
  if (value === undefined || value === false || value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value) || !HEX_64.test(value.sha256)) throw new Error('PyPI core metadata digest shape changed')
  return value.sha256
}

function assertDistributionUrl(value, filename) {
  if (typeof value !== 'string') throw new Error('PyPI distribution URL is missing')
  let url
  try { url = new URL(value) } catch { throw new Error('PyPI distribution URL is invalid') }
  if (url.protocol !== 'https:' || url.hostname !== FILES_HOST || url.username || url.password || url.search || url.hash) throw new Error('PyPI distribution URL escaped files.pythonhosted.org')
  if (!url.pathname.endsWith(`/${encodeURIComponent(filename)}`) && !decodeURIComponent(url.pathname).endsWith(`/${filename}`)) throw new Error('PyPI distribution URL does not match its filename')
  return url.href
}

function normalizeDistribution(file) {
  const valid = file
    && typeof file === 'object'
    && !Array.isArray(file)
    && typeof file.filename === 'string'
    && file.filename.length > 0
    && file.filename.length <= 255
    && !/[\\/\r\n]/.test(file.filename)
    && typeof file.packagetype === 'string'
    && typeof file.python_version === 'string'
    && Number.isInteger(file.size)
    && file.size >= 0
    && typeof file.upload_time_iso_8601 === 'string'
    && Number.isFinite(Date.parse(file.upload_time_iso_8601))
    && typeof file.yanked === 'boolean'
    && file.digests
    && HEX_64.test(file.digests.sha256)
    && HEX_64.test(file.digests.blake2b_256)
  if (!valid) throw new Error('PyPI distribution metadata shape changed')
  return {
    filename: file.filename,
    packageType: file.packagetype,
    pythonVersion: file.python_version,
    requiresPython: optionalString(file.requires_python, 'distribution requires_python', { maxLength: 512 }),
    sizeBytes: file.size,
    uploadedAt: new Date(file.upload_time_iso_8601).toISOString(),
    yanked: file.yanked,
    yankedReason: optionalString(file.yanked_reason, 'distribution yanked_reason'),
    url: assertDistributionUrl(file.url, file.filename),
    sha256: file.digests.sha256,
    blake2b256: file.digests.blake2b_256,
    coreMetadataSha256: coreMetadataSha256(file),
  }
}

function assertPayload(payload, input) {
  const valid = payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
    && payload.info
    && typeof payload.info === 'object'
    && typeof payload.info.name === 'string'
    && normalizeProjectName(payload.info.name) === input.projectName
    && payload.info.version === input.version
    && Number.isInteger(payload.last_serial)
    && payload.last_serial >= 0
    && Array.isArray(payload.urls)
    && payload.urls.length >= 1
    && payload.urls.length <= MAX_DISTRIBUTIONS
    && Array.isArray(payload.vulnerabilities)
  if (!valid) throw new Error('PyPI release response identity or bounded shape changed')
}

function parseSerialHeader(headers) {
  const value = headers.get('x-pypi-last-serial')
  return value !== null && /^\d+$/.test(value) ? Number(value) : null
}

export function normalizePublicProjectReleaseResponse(payload, { input, headers = new Headers(), observedAt = new Date().toISOString() }) {
  const normalizedInput = assertInput(input)
  assertPayload(payload, normalizedInput)
  const distributions = payload.urls.map(normalizeDistribution).sort((left, right) => left.filename.localeCompare(right.filename))
  const headerSerial = parseSerialHeader(headers)
  const etag = headers.get('etag')
  const projection = {
    source: { id: 'pypi-public-project-release', apiBaseUrl: PYPI_BASE_URL },
    request: normalizedInput,
    release: {
      canonicalProjectName: normalizedInput.projectName,
      publishedProjectName: payload.info.name,
      version: payload.info.version,
      summary: optionalString(payload.info.summary, 'summary'),
      requiresPython: optionalString(payload.info.requires_python, 'requires_python', { maxLength: 512 }),
      licenseExpression: optionalString(payload.info.license_expression, 'license_expression', { maxLength: 512 }),
      licenseClassifiers: normalizeLicenseClassifiers(payload.info.classifiers),
      projectUrls: normalizeProjectUrls(payload.info.project_urls),
      yanked: Boolean(payload.info.yanked),
      yankedReason: optionalString(payload.info.yanked_reason, 'yanked_reason'),
      knownVulnerabilityCount: payload.vulnerabilities.length,
    },
    distributions,
  }
  const assertions = [
    { id: 'exact-release-identity', passed: true },
    { id: 'bounded-distributions', passed: distributions.length <= MAX_DISTRIBUTIONS },
    { id: 'distribution-integrity', passed: distributions.every((file) => HEX_64.test(file.sha256) && HEX_64.test(file.blake2b256)) },
    { id: 'pypi-file-origins', passed: distributions.every((file) => new URL(file.url).hostname === FILES_HOST) },
    { id: 'etag-present', passed: typeof etag === 'string' && etag.length > 0 },
    { id: 'serial-consistent', passed: headerSerial === payload.last_serial },
    { id: 'personal-fields-excluded', passed: !['author', 'authorEmail', 'maintainer', 'maintainerEmail'].some((field) => Object.hasOwn(projection.release, field)) },
  ]
  return {
    ...projection,
    registryState: {
      lastSerial: payload.last_serial,
      etag,
      cacheControl: headers.get('cache-control'),
    },
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicProjectRelease(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  const url = new URL(`/pypi/${encodeURIComponent(normalizedInput.projectName)}/${encodeURIComponent(normalizedInput.version)}/json`, PYPI_BASE_URL)
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
    throw new PyPIPublicProjectReleaseError(
      `PyPI public project release read failed: HTTP_${response.status}; retryAfter=${retryAfter ?? 'unknown'}`,
      { code: response.status === 429 ? 'rate-limited' : `http-${response.status}`, httpStatus: response.status, retryAfter, retryAt },
    )
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`PyPI public project release read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('PyPI public project release response exceeds the 2 MiB budget')
  const source = await response.text()
  if (Buffer.byteLength(source) > MAX_RESPONSE_BYTES) throw new Error('PyPI public project release response exceeds the 2 MiB budget')
  let payload
  try { payload = JSON.parse(source) } catch { throw new Error('PyPI public project release response is not valid JSON') }
  return normalizePublicProjectReleaseResponse(payload, { input: normalizedInput, headers: response.headers, observedAt: now().toISOString() })
}

import { createHash } from 'node:crypto'

export const CRATES_IO_BASE_URL = 'https://crates.io'
export const MAX_RESPONSE_BYTES = 1024 * 1024
export const MIN_REQUEST_INTERVAL_MS = 1000
export const MAX_BINARY_NAMES = 128

const ALLOWED_INPUT_KEYS = new Set(['crateName', 'version'])
const CRATE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/
const EXACT_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const digest = (value) => createHash('sha256').update(value).digest('hex')

export class CratesIoPublicCrateVersionError extends Error {
  constructor(message, { code, httpStatus, retryAfter = null, retryAt = null } = {}) {
    super(message)
    this.name = 'CratesIoPublicCrateVersionError'
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
  if (typeof input.crateName !== 'string' || !CRATE_NAME_PATTERN.test(input.crateName)) {
    throw new Error('crateName must use the exact registered crates.io spelling and contain 1-64 ASCII letters, digits, hyphens, or underscores')
  }
  if (typeof input.version !== 'string' || input.version.length > 128 || !EXACT_VERSION_PATTERN.test(input.version)) {
    throw new Error('version must be an exact semantic version')
  }
  return { crateName: input.crateName, version: input.version }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function optionalString(value, field, { maxLength = 4096 } = {}) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength || /\u0000/.test(value)) throw new Error(`crates.io ${field} shape changed`)
  return value
}

function optionalHttpsUrl(value, field) {
  const source = optionalString(value, field)
  if (source === null) return null
  let url
  try { url = new URL(source) } catch { throw new Error(`crates.io ${field} URL is invalid`) }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  return url.href
}

function normalizeBinaryNames(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_BINARY_NAMES) throw new Error('crates.io binary name list exceeds its bounded shape')
  const names = value.filter((name) => name !== null)
  if (names.some((name) => typeof name !== 'string' || name.length < 1 || name.length > 128 || /[\u0000-\u001f\u007f]/.test(name))) {
    throw new Error('crates.io binary name shape changed')
  }
  return [...new Set(names)].sort()
}

function parseTimestamp(value, field) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`crates.io ${field} shape changed`)
  return new Date(value).toISOString()
}

function downloadUrlFor(value, input) {
  if (typeof value !== 'string') throw new Error('crates.io download path is missing')
  let url
  try { url = new URL(value, CRATES_IO_BASE_URL) } catch { throw new Error('crates.io download path is invalid') }
  const expectedPath = `/api/v1/crates/${input.crateName}/${input.version}/download`
  let decodedPath
  try { decodedPath = decodeURIComponent(url.pathname) } catch { throw new Error('crates.io download path is invalid') }
  if (url.origin !== CRATES_IO_BASE_URL || url.username || url.password || url.search || url.hash || decodedPath !== expectedPath) {
    throw new Error('crates.io download path escaped the requested crate version')
  }
  return url.href
}

function assertPayload(payload, input) {
  const version = payload?.version
  const valid = payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
    && version
    && typeof version === 'object'
    && !Array.isArray(version)
    && version.crate === input.crateName
    && version.num === input.version
    && SHA256_PATTERN.test(version.checksum)
    && typeof version.yanked === 'boolean'
    && Number.isInteger(version.crate_size)
    && version.crate_size >= 0
  if (!valid) throw new Error('crates.io crate version response identity or integrity shape changed')
  return version
}

function retryMetadata(headers, now) {
  const retryAfter = headers.get('retry-after')
  let retryAt = null
  if (retryAfter !== null) {
    if (/^\d+$/.test(retryAfter)) retryAt = new Date(now.getTime() + Number(retryAfter) * 1000).toISOString()
    else if (Number.isFinite(Date.parse(retryAfter))) retryAt = new Date(retryAfter).toISOString()
  }
  return { retryAfter, retryAt }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`crates.io crate version read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new Error('crates.io crate version response exceeds the 1 MiB budget')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('crates.io crate version response has no body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let receivedBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw new Error('crates.io crate version response exceeds the 1 MiB budget')
      }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error.message.includes('1 MiB budget')) throw error
    throw new Error('crates.io crate version response is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new Error('crates.io crate version response is not valid JSON') }
}

export function createRequestGate({ minimumIntervalMs = MIN_REQUEST_INTERVAL_MS, nowMs = () => Date.now(), sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)) } = {}) {
  if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < MIN_REQUEST_INTERVAL_MS) throw new Error(`minimumIntervalMs cannot be below ${MIN_REQUEST_INTERVAL_MS}`)
  if (typeof nowMs !== 'function' || typeof sleep !== 'function') throw new Error('request gate clock and sleep must be functions')
  let nextStartAt = 0
  let queue = Promise.resolve()
  return async function acquireRequestSlot() {
    const slot = queue.then(async () => {
      const delay = Math.max(0, nextStartAt - nowMs())
      if (delay > 0) await sleep(delay)
      nextStartAt = nowMs() + minimumIntervalMs
    })
    queue = slot.catch(() => {})
    return slot
  }
}

const defaultRequestGate = createRequestGate()

export function normalizePublicCrateVersionResponse(payload, { input, observedAt = new Date().toISOString() } = {}) {
  const normalizedInput = assertInput(input)
  const version = assertPayload(payload, normalizedInput)
  if (version.has_lib !== undefined && version.has_lib !== null && typeof version.has_lib !== 'boolean') {
    throw new Error('crates.io has_lib shape changed')
  }
  const downloadUrl = downloadUrlFor(version.dl_path, normalizedInput)
  const projection = {
    source: {
      id: 'crates-io-public-crate-version',
      apiBaseUrl: CRATES_IO_BASE_URL,
      endpointTemplate: `${CRATES_IO_BASE_URL}/api/v1/crates/{crate}/{version}`,
    },
    request: normalizedInput,
    crateVersion: {
      crateName: version.crate,
      version: version.num,
      description: optionalString(version.description, 'description', { maxLength: 2048 }),
      licenseExpression: optionalString(version.license, 'license', { maxLength: 512 }),
      rustVersion: optionalString(version.rust_version, 'rust_version', { maxLength: 64 }),
      edition: optionalString(version.edition, 'edition', { maxLength: 16 }),
      yanked: version.yanked,
      yankedMessage: optionalString(version.yank_message, 'yank_message'),
      createdAt: parseTimestamp(version.created_at, 'created_at'),
      updatedAt: parseTimestamp(version.updated_at, 'updated_at'),
      hasLibrary: version.has_lib ?? null,
      binaryNames: normalizeBinaryNames(version.bin_names),
      links: {
        repository: optionalHttpsUrl(version.repository, 'repository'),
        homepage: optionalHttpsUrl(version.homepage, 'homepage'),
        documentation: optionalHttpsUrl(version.documentation, 'documentation'),
      },
      artifact: {
        sizeBytes: version.crate_size,
        sha256: version.checksum,
        downloadUrl,
      },
    },
  }
  const assertions = [
    { id: 'exact-crate-version', passed: true },
    { id: 'artifact-integrity', passed: SHA256_PATTERN.test(projection.crateVersion.artifact.sha256) },
    { id: 'official-download-origin', passed: new URL(downloadUrl).origin === CRATES_IO_BASE_URL },
    { id: 'bounded-binary-names', passed: projection.crateVersion.binaryNames.length <= MAX_BINARY_NAMES },
    { id: 'personal-fields-excluded', passed: !['publishedBy', 'auditActions', 'downloads', 'owners', 'authors'].some((field) => Object.hasOwn(projection.crateVersion, field)) },
    { id: 'unbounded-details-excluded', passed: !['features', 'dependencies', 'raw'].some((field) => Object.hasOwn(projection.crateVersion, field)) },
  ]
  return {
    ...projection,
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicCrateVersion(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
  requestGate = defaultRequestGate,
} = {}) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const normalizedUserAgent = assertUserAgent(userAgent)
  if (typeof requestGate !== 'function') throw new Error('requestGate must be a function')
  await requestGate()
  const url = new URL(`/api/v1/crates/${encodeURIComponent(normalizedInput.crateName)}/${encodeURIComponent(normalizedInput.version)}`, CRATES_IO_BASE_URL)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': normalizedUserAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const retry = retryMetadata(response.headers, now())
    const code = response.status === 429 ? 'rate-limited' : response.status === 403 ? 'access-policy-blocked' : `http-${response.status}`
    throw new CratesIoPublicCrateVersionError(
      `crates.io crate version read failed: HTTP_${response.status}; retryAfter=${retry.retryAfter ?? 'unknown'}`,
      { code, httpStatus: response.status, ...retry },
    )
  }
  return normalizePublicCrateVersionResponse(await readJsonResponse(response), { input: normalizedInput, observedAt: now().toISOString() })
}

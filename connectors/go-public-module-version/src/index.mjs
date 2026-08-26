import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { chmod, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

export const GO_PROXY_BASE_URL = 'https://proxy.golang.org'
export const GO_CHECKSUM_DATABASE = 'sum.golang.org'
export const GO_PROXY_STORAGE_HOST = 'storage.googleapis.com'
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
export const MAX_GO_MOD_BYTES = 256 * 1024
export const MAX_INFO_BYTES = 64 * 1024

const execFileAsync = promisify(execFile)
const ALLOWED_INPUT_KEYS = new Set(['modulePath', 'version', 'publicModuleAcknowledged'])
const MODULE_PATH_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[A-Za-z0-9](?:[A-Za-z0-9._~-]*[A-Za-z0-9])?)*$/
const EXACT_VERSION_PATTERN = /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+incompatible)?$/
const H1_PATTERN = /^h1:[A-Za-z0-9+/]{43}=$/

const digest = (value) => createHash('sha256').update(value).digest('hex')

export class GoPublicModuleVersionError extends Error {
  constructor(message, { code, httpStatus, retryAfter = null, retryAt = null } = {}) {
    super(message)
    this.name = 'GoPublicModuleVersionError'
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
  if (typeof input.modulePath !== 'string' || input.modulePath.length > 512 || !MODULE_PATH_PATTERN.test(input.modulePath) || !input.modulePath.split('/')[0].includes('.')) {
    throw new Error('modulePath must be an explicit public Go module path with a domain-like first segment')
  }
  if (input.modulePath.split('/').some((segment) => segment === '.' || segment === '..')) throw new Error('modulePath cannot contain dot segments')
  if (typeof input.version !== 'string' || input.version.length > 128 || !EXACT_VERSION_PATTERN.test(input.version)) {
    throw new Error('version must be an exact canonical Go module version')
  }
  if (input.publicModuleAcknowledged !== true) throw new Error('publicModuleAcknowledged must be true before sending a module path to public Go services')
  return { modulePath: input.modulePath, version: input.version, publicModuleAcknowledged: true }
}

export function escapeGoProxyElement(value) {
  return value.replace(/[A-Z]/g, (letter) => `!${letter.toLowerCase()}`)
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

async function preflightPublicModuleArchive(input, { fetchImpl, timeoutMs, userAgent, now }) {
  const encodedModule = escapeGoProxyElement(input.modulePath).split('/').map(encodeURIComponent).join('/')
  const encodedVersion = encodeURIComponent(escapeGoProxyElement(input.version))
  const url = new URL(`/${encodedModule}/@v/${encodedVersion}.zip`, GO_PROXY_BASE_URL)
  let response = await fetchImpl(url, {
    method: 'HEAD',
    headers: { accept: 'application/zip', 'user-agent': userAgent },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  })
  let delivery = 'direct'
  if (response.status === 302) {
    const location = response.headers.get('location')
    let storageUrl
    try { storageUrl = new URL(location) } catch { throw new Error('Go module proxy returned an invalid archive redirect') }
    const signedQuery = ['Expires', 'GoogleAccessId', 'Signature'].every((key) => storageUrl.searchParams.has(key))
    if (storageUrl.protocol !== 'https:'
      || storageUrl.hostname !== GO_PROXY_STORAGE_HOST
      || !storageUrl.pathname.startsWith('/proxy-golang-org-prod/')
      || storageUrl.username
      || storageUrl.password
      || storageUrl.hash
      || !signedQuery) {
      throw new Error('Go module proxy archive redirect escaped the official signed storage origin')
    }
    response = await fetchImpl(storageUrl, {
      method: 'HEAD',
      headers: { accept: 'application/zip', 'user-agent': userAgent },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    delivery = 'official-storage-redirect'
  }
  if (!response.ok) {
    const retry = retryMetadata(response.headers, now())
    throw new GoPublicModuleVersionError(
      `Go public module archive preflight failed: HTTP_${response.status}; retryAfter=${retry.retryAfter ?? 'unknown'}`,
      { code: response.status === 429 ? 'rate-limited' : `http-${response.status}`, httpStatus: response.status, ...retry },
    )
  }
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/zip')) throw new Error(`Go module archive preflight returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength === null || !/^\d+$/.test(declaredLength)) throw new Error('Go module archive preflight did not provide a bounded content length')
  const archiveSizeBytes = Number(declaredLength)
  if (!Number.isSafeInteger(archiveSizeBytes) || archiveSizeBytes <= 0 || archiveSizeBytes > MAX_ARCHIVE_BYTES) {
    throw new Error(`Go module archive exceeds the ${MAX_ARCHIVE_BYTES} byte transfer budget`)
  }
  return {
    archiveSizeBytes,
    delivery,
    archiveEtag: response.headers.get('etag'),
    cacheControl: response.headers.get('cache-control'),
  }
}

function parseGoVersion(stdout) {
  const match = String(stdout).trim().match(/^go version (go[0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:\s|$)/)
  if (!match) throw new Error('go command returned an unrecognized version string')
  const numeric = match[1].slice(2).split('.').map(Number)
  if (numeric[0] < 1 || (numeric[0] === 1 && numeric[1] < 20)) throw new Error('go command 1.20 or newer is required')
  return match[1]
}

function inside(root, candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false
  const relative = path.relative(root, path.resolve(candidate))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function classifyGoCommandError(error, temporaryRoot) {
  const detail = [error?.stdout, error?.stderr, error?.message]
    .filter(Boolean)
    .join('\n')
    .replaceAll(temporaryRoot, '[ephemeral-cache]')
  if (/429|too many requests|rate.?limit/i.test(detail)) {
    return new GoPublicModuleVersionError('Go public module authentication was rate limited', { code: 'rate-limited', httpStatus: 429 })
  }
  if (/SECURITY ERROR|checksum mismatch|verifying module/i.test(detail)) {
    return new GoPublicModuleVersionError('Go public module authentication failed', { code: 'authentication-failed' })
  }
  return new GoPublicModuleVersionError(`Go public module download failed: ${detail.slice(0, 2048)}`, { code: 'download-failed' })
}

async function makeTemporaryTreeWritable(directory) {
  await chmod(directory, 0o700)
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return makeTemporaryTreeWritable(target)
    if (!entry.isSymbolicLink()) await chmod(target, 0o600)
  }))
}

export async function downloadAuthenticatedPublicModule(input, { timeoutMs = 30_000 } = {}) {
  const normalizedInput = assertInput(input)
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'dsh-go-module-'))
  let result
  let operationError
  try {
    const environment = {
      PATH: process.env.PATH,
      TMPDIR: temporaryRoot,
      LANG: 'C',
      LC_ALL: 'C',
      GO111MODULE: 'on',
      GOAUTH: 'off',
      GOENV: 'off',
      GOFLAGS: '',
      GOCACHE: path.join(temporaryRoot, 'build-cache'),
      GOMODCACHE: path.join(temporaryRoot, 'module-cache'),
      GOPATH: path.join(temporaryRoot, 'gopath'),
      GOPRIVATE: '',
      GONOPROXY: '',
      GONOSUMDB: '',
      GOINSECURE: '',
      GOPROXY: GO_PROXY_BASE_URL,
      GOSUMDB: GO_CHECKSUM_DATABASE,
      GOTOOLCHAIN: 'local',
      GOVCS: '*:off',
      GOWORK: 'off',
    }
    const versionResult = await execFileAsync('go', ['version'], { cwd: temporaryRoot, env: environment, timeout: Math.min(timeoutMs, 10_000), maxBuffer: 1024 * 1024 })
    const goVersion = parseGoVersion(versionResult.stdout)
    const moduleQuery = `${normalizedInput.modulePath}@${normalizedInput.version}`
    const commandResult = await execFileAsync('go', ['mod', 'download', '-json', moduleQuery], {
      cwd: temporaryRoot,
      env: environment,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    })
    let download
    try { download = JSON.parse(commandResult.stdout) } catch { throw new Error('go mod download returned invalid JSON') }
    if (download.Error) throw new Error(`go mod download: ${download.Error}`)
    if (!inside(temporaryRoot, download.Info) || !inside(temporaryRoot, download.GoMod) || !inside(temporaryRoot, download.Zip) || !inside(temporaryRoot, download.Dir)) {
      throw new Error('go mod download returned a cache path outside the isolated temporary root')
    }
    const [infoStat, goModStat, infoContent, goModContent] = await Promise.all([
      stat(download.Info),
      stat(download.GoMod),
      readFile(download.Info),
      readFile(download.GoMod),
    ])
    if (infoStat.size > MAX_INFO_BYTES || infoContent.byteLength > MAX_INFO_BYTES) throw new Error('Go module version info exceeds the 64 KiB budget')
    if (goModStat.size > MAX_GO_MOD_BYTES || goModContent.byteLength > MAX_GO_MOD_BYTES) throw new Error('Go module go.mod exceeds the 256 KiB budget')
    result = { download, goVersion, infoContent, goModContent }
  } catch (error) {
    operationError = error instanceof GoPublicModuleVersionError ? error : classifyGoCommandError(error, temporaryRoot)
  }
  try {
    await makeTemporaryTreeWritable(temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 2 })
  } catch (error) {
    throw new GoPublicModuleVersionError(`isolated Go module cache cleanup failed: ${error.message}`, { code: 'cleanup-failed' })
  }
  if (operationError) throw operationError
  return { ...result, ephemeralCacheRemoved: true }
}

export function goModH1(content) {
  const fileDigest = createHash('sha256').update(content).digest('hex')
  return `h1:${createHash('sha256').update(`${fileDigest}  go.mod\n`).digest('base64')}`
}

function decodeUtf8(buffer, label) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch { throw new Error(`${label} is not valid UTF-8`) }
}

function moduleDirective(goModContent) {
  const line = goModContent.split(/\r?\n/).find((candidate) => /^\s*module\s+/.test(candidate))
  if (!line) throw new Error('go.mod does not contain a module directive')
  const match = line.match(/^\s*module\s+("(?:[^"\\]|\\.)*"|[^\s]+)\s*(?:\/\/.*)?$/)
  if (!match) throw new Error('go.mod module directive shape changed')
  if (!match[1].startsWith('"')) return match[1]
  try { return JSON.parse(match[1]) } catch { throw new Error('quoted go.mod module directive is not supported') }
}

export function normalizeGoPublicModuleVersion(raw, { input, preflight, observedAt = new Date().toISOString() } = {}) {
  const normalizedInput = assertInput(input)
  if (!raw || typeof raw !== 'object' || !raw.download || raw.ephemeralCacheRemoved !== true) throw new Error('authenticated Go download result is incomplete')
  const { download } = raw
  if (download.Path !== normalizedInput.modulePath || download.Version !== normalizedInput.version) throw new Error('Go module download identity drifted')
  if (!H1_PATTERN.test(download.Sum) || !H1_PATTERN.test(download.GoModSum)) throw new Error('Go module authenticated checksum shape changed')
  const infoBuffer = Buffer.isBuffer(raw.infoContent) ? raw.infoContent : Buffer.from(raw.infoContent ?? '')
  const goModBuffer = Buffer.isBuffer(raw.goModContent) ? raw.goModContent : Buffer.from(raw.goModContent ?? '')
  if (infoBuffer.byteLength > MAX_INFO_BYTES || goModBuffer.byteLength > MAX_GO_MOD_BYTES) throw new Error('Go module metadata exceeds its bounded projection')
  let versionInfo
  try { versionInfo = JSON.parse(decodeUtf8(infoBuffer, 'Go module version info')) } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Go module version info is not valid JSON')
    throw error
  }
  if (!versionInfo || versionInfo.Version !== normalizedInput.version || (versionInfo.Time !== undefined && !Number.isFinite(Date.parse(versionInfo.Time)))) {
    throw new Error('Go module version info identity or timestamp changed')
  }
  const goModContent = decodeUtf8(goModBuffer, 'go.mod')
  if (moduleDirective(goModContent) !== normalizedInput.modulePath) throw new Error('go.mod module directive does not match the requested module path')
  const computedGoModH1 = goModH1(goModBuffer)
  if (computedGoModH1 !== download.GoModSum) throw new Error('go.mod content does not match its authenticated checksum')
  if (!preflight || !Number.isSafeInteger(preflight.archiveSizeBytes) || preflight.archiveSizeBytes <= 0 || preflight.archiveSizeBytes > MAX_ARCHIVE_BYTES) {
    throw new Error('Go module archive preflight is missing or unbounded')
  }
  const projection = {
    source: { id: 'go-public-module-version', proxyBaseUrl: GO_PROXY_BASE_URL, checksumDatabase: GO_CHECKSUM_DATABASE },
    request: normalizedInput,
    moduleVersion: {
      modulePath: normalizedInput.modulePath,
      version: normalizedInput.version,
      publishedAt: versionInfo.Time ? new Date(versionInfo.Time).toISOString() : null,
      versionMetadataAuthentication: 'transport-only',
      moduleTreeH1: download.Sum,
      goMod: {
        moduleDirective: normalizedInput.modulePath,
        content: goModContent,
        sizeBytes: goModBuffer.byteLength,
        sha256: digest(goModBuffer),
        h1: download.GoModSum,
      },
    },
    authentication: {
      status: 'authenticated',
      method: 'go-command-sumdb',
      verifier: raw.goVersion,
      checksumDatabase: GO_CHECKSUM_DATABASE,
      moduleTreeAuthenticated: true,
      goModAuthenticated: true,
    },
    transfer: {
      archiveSizeBytes: preflight.archiveSizeBytes,
      delivery: preflight.delivery ?? 'direct',
      archiveDownloaded: true,
      archiveExecuted: false,
      cacheScope: 'ephemeral',
      cacheRemoved: true,
    },
    registryState: { archiveEtag: preflight.archiveEtag ?? null, cacheControl: preflight.cacheControl ?? null },
  }
  const assertions = [
    { id: 'exact-module-version', passed: true },
    { id: 'public-module-acknowledged', passed: true },
    { id: 'module-tree-authenticated', passed: true },
    { id: 'go-mod-authenticated', passed: true },
    { id: 'go-mod-identity', passed: true },
    { id: 'bounded-archive-transfer', passed: preflight.archiveSizeBytes <= MAX_ARCHIVE_BYTES },
    { id: 'ephemeral-cache-removed', passed: raw.ephemeralCacheRemoved === true },
    { id: 'module-code-not-executed', passed: true },
  ]
  return {
    ...projection,
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readAuthenticatedPublicModuleVersion(input, {
  fetchImpl = fetch,
  downloadImpl = downloadAuthenticatedPublicModule,
  timeoutMs = 30_000,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  const normalizedInput = assertInput(input)
  const preflight = await preflightPublicModuleArchive(normalizedInput, { fetchImpl, timeoutMs: Math.min(timeoutMs, 15_000), userAgent, now })
  const raw = await downloadImpl(normalizedInput, { timeoutMs })
  return normalizeGoPublicModuleVersion(raw, { input: normalizedInput, preflight, observedAt: now().toISOString() })
}

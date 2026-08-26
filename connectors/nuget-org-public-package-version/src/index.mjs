import { createHash } from 'node:crypto'

export const SERVICE_INDEX_URL = 'https://api.nuget.org/v3/index.json'
export const REGISTRATION_RESOURCE_TYPE = 'RegistrationsBaseUrl/3.6.0'
export const PACKAGE_CONTENT_RESOURCE_TYPE = 'PackageBaseAddress/3.0.0'
export const MAX_SERVICE_INDEX_BYTES = 512 * 1024
export const MAX_REGISTRATION_BYTES = 4 * 1024 * 1024
export const MAX_PACKAGE_BYTES = 32 * 1024 * 1024
export const MAX_REGISTRATION_PAGES = 64
export const MAX_ZIP_ENTRIES = 4096

const ALLOWED_INPUT_KEYS = new Set(['packageId', 'version'])
const PACKAGE_ID_PATTERN = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9_])?$/
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\.(?:[1-9]\d*))?(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const ALLOWED_ORIGINS = new Set(['https://api.nuget.org', 'https://nuget.azure.cn'])
const JSON_MEDIA_TYPES = new Set(['application/json', 'application/json; charset=utf-8'])
const PACKAGE_MEDIA_TYPES = new Set(['application/octet-stream', 'application/zip', 'application/x-zip-compressed'])
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sha512 = (value) => createHash('sha512').update(value).digest('hex')

export class NuGetOrgPublicPackageVersionError extends Error {
  constructor(message, { code, httpStatus = null, phase = null, retryAfter = null } = {}) {
    super(message)
    this.name = 'NuGetOrgPublicPackageVersionError'
    this.code = code
    this.httpStatus = httpStatus
    this.phase = phase
    this.retryAfter = retryAfter
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.packageId !== 'string' || input.packageId.length > 100 || !PACKAGE_ID_PATTERN.test(input.packageId) || /(?:\.{2}|-{2})/.test(input.packageId)) {
    throw new Error('packageId must use the supported NuGet.org package ID subset')
  }
  if (typeof input.version !== 'string' || input.version.length > 64 || !VERSION_PATTERN.test(input.version)) {
    throw new Error('version must be an exact normalized NuGet version in the supported subset')
  }
  return { packageId: input.packageId, version: input.version }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || /[\r\n]/.test(userAgent) || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function parseVersion(value) {
  if (typeof value !== 'string') throw new Error('NuGet registration version shape changed')
  const match = value.toLowerCase().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9a-z-]+(?:\.[0-9a-z-]+)*))?(?:\+[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/)
  if (!match) throw new Error('NuGet registration version is outside the comparable subset')
  return {
    numeric: [match[1], match[2] ?? '0', match[3] ?? '0', match[4] ?? '0'].map((part) => BigInt(part)),
    prerelease: match[5] === undefined ? null : match[5].split('.'),
  }
}

function compareVersions(leftValue, rightValue) {
  const left = parseVersion(leftValue)
  const right = parseVersion(rightValue)
  for (let index = 0; index < 4; index += 1) {
    if (left.numeric[index] < right.numeric[index]) return -1
    if (left.numeric[index] > right.numeric[index]) return 1
  }
  if (left.prerelease === null && right.prerelease === null) return 0
  if (left.prerelease === null) return 1
  if (right.prerelease === null) return -1
  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index]
    const rightPart = right.prerelease[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)
    if (leftNumeric && rightNumeric) {
      const leftNumber = BigInt(leftPart)
      const rightNumber = BigInt(rightPart)
      if (leftNumber < rightNumber) return -1
      if (leftNumber > rightNumber) return 1
    } else if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    else if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1
  }
  return 0
}

function exactVersionEqual(left, right) {
  return compareVersions(left, right) === 0 && left.toLowerCase().replace(/\+.*$/, '') === right.toLowerCase()
}

function validateOfficialUrl(value, { prefix = null, label }) {
  let url
  try { url = new URL(value) } catch { throw new Error(`${label} URL is invalid`) }
  if (url.protocol !== 'https:' || url.origin !== 'https://api.nuget.org' || url.username || url.password || url.hash) throw new Error(`${label} escaped api.nuget.org`)
  if (prefix !== null && !url.pathname.startsWith(prefix)) throw new Error(`${label} path changed`)
  return url
}

function redirectTarget(response, currentUrl, phase) {
  const location = response.headers.get('location')
  if (![301, 302].includes(response.status) || !location) throw new NuGetOrgPublicPackageVersionError(`NuGet.org ${phase} failed: HTTP_${response.status}`, { code: response.status === 429 ? 'rate-limited' : response.status === 404 ? 'not-found' : `http-${response.status}`, httpStatus: response.status, phase, retryAfter: response.headers.get('retry-after') })
  let target
  try { target = new URL(location, currentUrl) } catch { throw new Error(`NuGet.org ${phase} redirect URL is invalid`) }
  if (target.protocol !== 'https:' || !ALLOWED_ORIGINS.has(target.origin) || target.username || target.password || target.hash || target.pathname !== currentUrl.pathname || target.search !== currentUrl.search) {
    throw new Error(`NuGet.org ${phase} redirect escaped the allowed official route`)
  }
  if (target.href === currentUrl.href) throw new Error(`NuGet.org ${phase} redirect loop detected`)
  return target
}

async function fetchOfficial(url, { fetchImpl, headers, signal, phase, metrics }) {
  let current = new URL(url)
  for (let hop = 0; hop <= 1; hop += 1) {
    metrics.transportGetCount += 1
    metrics.transportOrigins.add(current.origin)
    const response = await fetchImpl(current, { method: 'GET', headers, redirect: 'manual', signal })
    if (response.ok) return response
    if (![301, 302].includes(response.status)) {
      throw new NuGetOrgPublicPackageVersionError(`NuGet.org ${phase} failed: HTTP_${response.status}`, { code: response.status === 429 ? 'rate-limited' : response.status === 403 ? 'access-policy-blocked' : response.status === 404 ? 'not-found' : `http-${response.status}`, httpStatus: response.status, phase, retryAfter: response.headers.get('retry-after') })
    }
    if (hop === 1) throw new Error(`NuGet.org ${phase} exceeded the one-redirect budget`)
    current = redirectTarget(response, current, phase)
    metrics.redirectCount += 1
  }
  throw new Error(`NuGet.org ${phase} redirect state is invalid`)
}

async function readBoundedBytes(response, { maxBytes, label, allowedMediaTypes }) {
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!allowedMediaTypes.has(contentType) && !(allowedMediaTypes === JSON_MEDIA_TYPES && contentType === 'application/json')) throw new Error(`${label} returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) throw new Error(`${label} exceeds the response budget`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`${label} has no response body`)
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new Error(`${label} exceeds the response budget`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function parseJson(bytes, label) {
  let source
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error(`${label} is not valid UTF-8`) }
  try { return JSON.parse(source) } catch { throw new Error(`${label} is not valid JSON`) }
}

function findResource(serviceIndex, type, prefix) {
  if (!serviceIndex || typeof serviceIndex !== 'object' || Array.isArray(serviceIndex) || typeof serviceIndex.version !== 'string' || !serviceIndex.version.startsWith('3.') || !Array.isArray(serviceIndex.resources)) {
    throw new Error('NuGet.org service index shape changed')
  }
  const matches = serviceIndex.resources.filter((resource) => resource?.['@type'] === type)
  if (matches.length !== 1) throw new Error(`NuGet.org service index ${type} resource changed`)
  return validateOfficialUrl(matches[0]['@id'], { prefix, label: type }).href
}

function pageContainsVersion(page, version) {
  if (typeof page?.lower !== 'string' || typeof page?.upper !== 'string') throw new Error('NuGet registration page bounds changed')
  return compareVersions(page.lower, version) <= 0 && compareVersions(page.upper, version) >= 0
}

function normalizeOptionalString(value, field, maxLength = 512) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`NuGet ${field} shape changed`)
  return value
}

function normalizeHttpsUrl(value, field) {
  const text = normalizeOptionalString(value, field, 2048)
  if (text === null) return null
  let url
  try { url = new URL(text) } catch { return null }
  return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
}

function normalizeDeprecation(value) {
  if (value === undefined || value === null) return { deprecated: false, reasons: [], alternatePackage: null }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.reasons) || value.reasons.length < 1 || value.reasons.length > 8) throw new Error('NuGet deprecation shape changed')
  const known = new Set(['legacy', 'criticalbugs', 'other'])
  const reasons = [...new Set(value.reasons.map((reason) => typeof reason === 'string' && known.has(reason.toLowerCase()) ? reason.toLowerCase() : 'other'))].sort()
  let alternatePackage = null
  if (value.alternatePackage !== undefined && value.alternatePackage !== null) {
    const alternate = value.alternatePackage
    if (!alternate || typeof alternate !== 'object' || Array.isArray(alternate) || typeof alternate.id !== 'string' || !PACKAGE_ID_PATTERN.test(alternate.id)) throw new Error('NuGet alternate package shape changed')
    alternatePackage = { id: alternate.id, range: normalizeOptionalString(alternate.range, 'alternate package range', 256) }
  }
  return { deprecated: true, reasons, alternatePackage }
}

function normalizeVulnerabilities(value) {
  if (value === undefined || value === null) return { total: 0, bySeverity: { low: 0, moderate: 0, high: 0, critical: 0 } }
  if (!Array.isArray(value) || value.length > 256) throw new Error('NuGet vulnerability metadata shape changed')
  const bySeverity = { low: 0, moderate: 0, high: 0, critical: 0 }
  const names = ['low', 'moderate', 'high', 'critical']
  for (const item of value) {
    if (!item || typeof item !== 'object' || !/^[0-3]$/.test(item.severity)) throw new Error('NuGet vulnerability severity shape changed')
    bySeverity[names[Number(item.severity)]] += 1
  }
  return { total: value.length, bySeverity }
}

function normalizeLeaf(leaf, input, packageBaseUrl) {
  if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf) || !leaf.catalogEntry || typeof leaf.catalogEntry !== 'object') throw new Error('NuGet registration leaf shape changed')
  const entry = leaf.catalogEntry
  if (typeof entry.id !== 'string' || entry.id.toLowerCase() !== input.packageId.toLowerCase() || typeof entry.version !== 'string' || !exactVersionEqual(entry.version, input.version)) {
    throw new Error('NuGet registration leaf identity changed')
  }
  const lowerId = input.packageId.toLowerCase()
  const lowerVersion = input.version.toLowerCase()
  const expectedContent = new URL(`${lowerId}/${lowerVersion}/${lowerId}.${lowerVersion}.nupkg`, packageBaseUrl).href
  const contentUrl = validateOfficialUrl(leaf.packageContent, { prefix: '/v3-flatcontainer/', label: 'package content' }).href
  if (contentUrl !== expectedContent) throw new Error('NuGet package content URL does not match the requested package version')
  const listed = entry.listed === undefined ? true : entry.listed
  if (typeof listed !== 'boolean') throw new Error('NuGet listed state changed')
  const publishedAt = normalizeOptionalString(entry.published, 'published timestamp', 64)
  if (publishedAt !== null && !Number.isFinite(Date.parse(publishedAt))) throw new Error('NuGet published timestamp changed')
  const unlisted = !listed || publishedAt?.startsWith('1900-') === true
  return {
    contentUrl,
    metadata: {
      id: entry.id,
      version: input.version,
      listed: !unlisted,
      publishedAt: unlisted ? null : publishedAt,
      prerelease: input.version.includes('-'),
      minClientVersion: normalizeOptionalString(entry.minClientVersion, 'minimum client version', 64),
      license: {
        expression: normalizeOptionalString(entry.licenseExpression, 'license expression', 256),
        url: normalizeHttpsUrl(entry.licenseUrl, 'license URL'),
        requiresAcceptance: entry.requireLicenseAcceptance === true,
      },
      projectUrl: normalizeHttpsUrl(entry.projectUrl, 'project URL'),
      deprecation: normalizeDeprecation(entry.deprecation),
      vulnerabilities: normalizeVulnerabilities(entry.vulnerabilities),
    },
  }
}

function findEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const lower = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - 22; offset >= lower; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset
  }
  throw new Error('NuGet package is not a bounded ZIP archive')
}

function inspectZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(bytes)
  const disk = view.getUint16(eocd + 4, true)
  const centralDisk = view.getUint16(eocd + 6, true)
  const diskEntries = view.getUint16(eocd + 8, true)
  const totalEntries = view.getUint16(eocd + 10, true)
  const centralSize = view.getUint32(eocd + 12, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  const commentLength = view.getUint16(eocd + 20, true)
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries || totalEntries < 1 || totalEntries > MAX_ZIP_ENTRIES || totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('NuGet package ZIP layout is unsupported or exceeds bounds')
  if (eocd + 22 + commentLength !== bytes.byteLength || centralOffset + centralSize > eocd) throw new Error('NuGet package ZIP central directory bounds changed')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries = []
  let offset = centralOffset
  let totalUncompressedBytes = 0
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('NuGet package ZIP central directory is malformed')
    const flags = view.getUint16(offset + 8, true)
    if ((flags & 0x1) !== 0) throw new Error('NuGet package contains encrypted ZIP entries')
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const entryCommentLength = view.getUint16(offset + 32, true)
    const next = offset + 46 + nameLength + extraLength + entryCommentLength
    if (nameLength < 1 || next > centralOffset + centralSize || uncompressedSize === 0xffffffff) throw new Error('NuGet package ZIP entry exceeds bounds')
    let name
    try { name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)) } catch { throw new Error('NuGet package ZIP entry name is not valid UTF-8') }
    if (name.includes('\0') || name.length > 1024) throw new Error('NuGet package ZIP entry name exceeds bounds')
    entries.push({ name, uncompressedSize })
    totalUncompressedBytes += uncompressedSize
    if (!Number.isSafeInteger(totalUncompressedBytes)) throw new Error('NuGet package declared uncompressed bytes exceed the safe integer range')
    offset = next
  }
  if (offset !== centralOffset + centralSize) throw new Error('NuGet package ZIP central directory length changed')
  const signatures = entries.filter((entry) => entry.name === '.signature.p7s')
  const manifests = entries.filter((entry) => !entry.name.includes('/') && entry.name.toLowerCase().endsWith('.nuspec'))
  if (signatures.length !== 1 || signatures[0].uncompressedSize < 1 || signatures[0].uncompressedSize > 256 * 1024) throw new Error('NuGet package repository signature entry changed')
  if (manifests.length !== 1 || manifests[0].uncompressedSize < 1 || manifests[0].uncompressedSize > 1024 * 1024) throw new Error('NuGet package manifest entry changed')
  return {
    entryCount: totalEntries,
    declaredUncompressedBytes: totalUncompressedBytes,
    centralDirectorySha256: sha256(bytes.subarray(centralOffset, centralOffset + centralSize)),
    manifestEntry: { name: manifests[0].name, sizeBytes: manifests[0].uncompressedSize },
    signatureEntry: { name: signatures[0].name, sizeBytes: signatures[0].uncompressedSize },
  }
}

function matchLeaf(items, input) {
  if (!Array.isArray(items) || items.length > 128) throw new Error('NuGet registration leaf collection exceeds bounds')
  return items.find((leaf) => typeof leaf?.catalogEntry?.version === 'string' && exactVersionEqual(leaf.catalogEntry.version, input.version)) ?? null
}

export async function readPublicPackageVersionEvidence(input, { fetchImpl = fetch, timeoutMs = 30_000, userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)', now = () => new Date() } = {}) {
  const request = assertInput(input)
  assertUserAgent(userAgent)
  const metrics = { logicalGetCount: 0, transportGetCount: 0, redirectCount: 0, transportOrigins: new Set() }
  const signal = AbortSignal.timeout(timeoutMs)
  const headers = { accept: 'application/json', 'user-agent': userAgent }

  metrics.logicalGetCount += 1
  const serviceResponse = await fetchOfficial(SERVICE_INDEX_URL, { fetchImpl, headers, signal, phase: 'service-index', metrics })
  const serviceIndex = parseJson(await readBoundedBytes(serviceResponse, { maxBytes: MAX_SERVICE_INDEX_BYTES, label: 'NuGet.org service index', allowedMediaTypes: JSON_MEDIA_TYPES }), 'NuGet.org service index')
  const registrationBase = findResource(serviceIndex, REGISTRATION_RESOURCE_TYPE, '/v3/registration5-gz-semver2/')
  const packageBase = findResource(serviceIndex, PACKAGE_CONTENT_RESOURCE_TYPE, '/v3-flatcontainer/')

  const lowerId = request.packageId.toLowerCase()
  metrics.logicalGetCount += 1
  const registrationUrl = new URL(`${lowerId}/index.json`, registrationBase)
  const registrationResponse = await fetchOfficial(registrationUrl, { fetchImpl, headers, signal, phase: 'registration-index', metrics })
  const registration = parseJson(await readBoundedBytes(registrationResponse, { maxBytes: MAX_REGISTRATION_BYTES, label: 'NuGet registration index', allowedMediaTypes: JSON_MEDIA_TYPES }), 'NuGet registration index')
  if (!registration || typeof registration !== 'object' || !Array.isArray(registration.items) || registration.items.length < 1 || registration.items.length > MAX_REGISTRATION_PAGES || registration.count !== registration.items.length) throw new Error('NuGet registration index page collection changed')
  const page = registration.items.find((candidate) => pageContainsVersion(candidate, request.version))
  if (!page) throw new NuGetOrgPublicPackageVersionError('NuGet.org exact package version was not found', { code: 'not-found', httpStatus: 404, phase: 'registration-index' })
  let leaves = page.items
  if (leaves === undefined) {
    const pageUrl = validateOfficialUrl(page['@id'], { prefix: '/v3/registration5-gz-semver2/', label: 'registration page' })
    metrics.logicalGetCount += 1
    const pageResponse = await fetchOfficial(pageUrl, { fetchImpl, headers, signal, phase: 'registration-page', metrics })
    const pagePayload = parseJson(await readBoundedBytes(pageResponse, { maxBytes: MAX_REGISTRATION_BYTES, label: 'NuGet registration page', allowedMediaTypes: JSON_MEDIA_TYPES }), 'NuGet registration page')
    if (!pagePayload || typeof pagePayload !== 'object' || !Array.isArray(pagePayload.items) || pagePayload.count !== pagePayload.items.length) throw new Error('NuGet registration page shape changed')
    leaves = pagePayload.items
  }
  const leaf = matchLeaf(leaves, request)
  if (!leaf) throw new NuGetOrgPublicPackageVersionError('NuGet.org exact package version was not found', { code: 'not-found', httpStatus: 404, phase: 'registration-leaf' })
  const normalizedLeaf = normalizeLeaf(leaf, request, packageBase)

  metrics.logicalGetCount += 1
  const packageResponse = await fetchOfficial(normalizedLeaf.contentUrl, { fetchImpl, headers: { accept: 'application/octet-stream', 'user-agent': userAgent }, signal, phase: 'package-content', metrics })
  const packageBytes = await readBoundedBytes(packageResponse, { maxBytes: MAX_PACKAGE_BYTES, label: 'NuGet package content', allowedMediaTypes: PACKAGE_MEDIA_TYPES })
  const archive = inspectZip(packageBytes)
  const packageSha512Hex = sha512(packageBytes)
  const packageSha512Base64 = Buffer.from(packageSha512Hex, 'hex').toString('base64')
  const serverSha512 = packageResponse.headers.get('x-ms-meta-sha512')
  if (serverSha512 !== null && serverSha512 !== packageSha512Base64) throw new Error('NuGet package server SHA-512 header does not match downloaded bytes')

  const projection = {
    source: {
      id: 'nuget-org-public-package-version',
      serviceIndexUrl: SERVICE_INDEX_URL,
      registrationResourceType: REGISTRATION_RESOURCE_TYPE,
      packageContentResourceType: PACKAGE_CONTENT_RESOURCE_TYPE,
    },
    request,
    packageVersion: {
      ...normalizedLeaf.metadata,
      artifact: {
        fileName: `${lowerId}.${request.version.toLowerCase()}.nupkg`,
        contentUrl: normalizedLeaf.contentUrl,
        sizeBytes: packageBytes.byteLength,
        sha256: sha256(packageBytes),
        sha512: packageSha512Hex,
        serverSha512Matched: serverSha512 === null ? null : true,
        ...archive,
        signaturePresent: true,
        signatureCryptographicallyVerified: false,
      },
    },
    access: {
      authentication: 'none',
      logicalGetCount: metrics.logicalGetCount,
      transportGetCount: metrics.transportGetCount,
      redirectCount: metrics.redirectCount,
      transportOrigins: [...metrics.transportOrigins].sort(),
      packageDownloaded: true,
      packageInstalled: false,
      packageExecuted: false,
      dependenciesResolved: false,
    },
  }
  const assertions = [
    { id: 'exact-package-version', passed: true },
    { id: 'service-index-resource-discovery', passed: true },
    { id: 'package-content-origin-and-path', passed: true },
    { id: 'bounded-package-download', passed: packageBytes.byteLength <= MAX_PACKAGE_BYTES },
    { id: 'local-sha256-and-sha512', passed: /^[a-f0-9]{64}$/.test(projection.packageVersion.artifact.sha256) && /^[a-f0-9]{128}$/.test(packageSha512Hex) },
    { id: 'server-sha512-conformance', passed: serverSha512 === null || projection.packageVersion.artifact.serverSha512Matched === true },
    { id: 'repository-signature-presence-only', passed: projection.packageVersion.artifact.signaturePresent && !projection.packageVersion.artifact.signatureCryptographicallyVerified },
    { id: 'no-install-execution-or-dependency-resolution', passed: !projection.access.packageInstalled && !projection.access.packageExecuted && !projection.access.dependenciesResolved },
    { id: 'personal-fields-excluded', passed: !Object.hasOwn(projection.packageVersion, 'authors') && !Object.hasOwn(projection.packageVersion, 'owners') },
  ]
  return {
    ...projection,
    observedAt: now().toISOString(),
    resultDigest: sha256(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

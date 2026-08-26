import { createHash } from 'node:crypto'

export const MAVEN_CENTRAL_ORIGIN = 'https://repo.maven.apache.org'
export const MAVEN_CENTRAL_ROOT = `${MAVEN_CENTRAL_ORIGIN}/maven2`
export const RELEASE_ENDPOINT_TEMPLATE = `${MAVEN_CENTRAL_ROOT}/{groupPath}/{artifactId}/{version}/{fileName}`
export const MAX_POM_BYTES = 1024 * 1024
export const MAX_JAR_BYTES = 32 * 1024 * 1024
export const MAX_CHECKSUM_BYTES = 1024
export const MAX_SIGNATURE_BYTES = 256 * 1024

const ALLOWED_INPUT_KEYS = new Set(['groupId', 'artifactId', 'version'])
const GROUP_ID_PATTERN = /^[A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*$/
const ARTIFACT_ID_PATTERN = /^[A-Za-z0-9_](?:[A-Za-z0-9_.+-]*[A-Za-z0-9_])?$/
const VERSION_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._+-]*[A-Za-z0-9])?$/
const SHA1_PATTERN = /^[a-f0-9]{40}$/
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const hash = (algorithm, value) => createHash(algorithm).update(value).digest('hex')

export class MavenCentralPublicJarReleaseError extends Error {
  constructor(message, { code, httpStatus = null, phase = null } = {}) {
    super(message)
    this.name = 'MavenCentralPublicJarReleaseError'
    this.code = code
    this.httpStatus = httpStatus
    this.phase = phase
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.groupId !== 'string' || input.groupId.length > 255 || !GROUP_ID_PATTERN.test(input.groupId)) {
    throw new Error('groupId must use the supported exact Maven coordinate subset')
  }
  if (typeof input.artifactId !== 'string' || input.artifactId.length > 128 || !ARTIFACT_ID_PATTERN.test(input.artifactId)) {
    throw new Error('artifactId must use the supported exact Maven coordinate subset')
  }
  if (typeof input.version !== 'string' || input.version.length > 128 || !VERSION_PATTERN.test(input.version)
    || /(?:^|[-.])SNAPSHOT$/i.test(input.version) || /^(?:LATEST|RELEASE)$/i.test(input.version)) {
    throw new Error('version must be an exact non-SNAPSHOT Maven release version')
  }
  return { groupId: input.groupId, artifactId: input.artifactId, version: input.version }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function artifactPaths(input) {
  const groupPath = input.groupId.split('.').map(encodeURIComponent).join('/')
  const artifactId = encodeURIComponent(input.artifactId)
  const version = encodeURIComponent(input.version)
  const baseName = `${input.artifactId}-${input.version}`
  const directory = `${MAVEN_CENTRAL_ROOT}/${groupPath}/${artifactId}/${version}`
  return {
    repositoryPath: `${input.groupId.replaceAll('.', '/')}/${input.artifactId}/${input.version}`,
    pom: { fileName: `${baseName}.pom`, url: `${directory}/${encodeURIComponent(baseName)}.pom` },
    pomSha1: { fileName: `${baseName}.pom.sha1`, url: `${directory}/${encodeURIComponent(baseName)}.pom.sha1` },
    jar: { fileName: `${baseName}.jar`, url: `${directory}/${encodeURIComponent(baseName)}.jar` },
    jarSha1: { fileName: `${baseName}.jar.sha1`, url: `${directory}/${encodeURIComponent(baseName)}.jar.sha1` },
    jarSignature: { fileName: `${baseName}.jar.asc`, url: `${directory}/${encodeURIComponent(baseName)}.jar.asc` },
  }
}

function parsePomCoordinates(bytes, expected) {
  let source
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('Maven Central POM is not valid UTF-8') }
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source)) throw new Error('Maven Central POM contains unsupported XML constructs')
  source = source.replace(/<!--[\s\S]*?-->/g, '')
  const stack = []
  const values = new Map()
  const interesting = new Set([
    'project/modelVersion', 'project/groupId', 'project/artifactId', 'project/version', 'project/packaging',
    'project/parent/groupId', 'project/parent/version',
  ])
  const tokens = source.match(/<[^>]+>|[^<]+/g) ?? []
  for (const token of tokens) {
    if (token.startsWith('<?') && token.endsWith('?>')) continue
    if (token.startsWith('</')) {
      const match = token.match(/^<\/\s*([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/)
      if (!match) throw new Error('Maven Central POM closing tag changed')
      const localName = match[1].split(':').at(-1)
      if (stack.pop() !== localName) throw new Error('Maven Central POM nesting changed')
      continue
    }
    if (token.startsWith('<')) {
      const match = token.match(/^<\s*([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s[^<>]*?)?\s*(\/?)>$/)
      if (!match) throw new Error('Maven Central POM opening tag changed')
      const localName = match[1].split(':').at(-1)
      if (match[2] !== '/') {
        stack.push(localName)
        if (stack.length > 64) throw new Error('Maven Central POM nesting exceeds the safe bound')
      }
      continue
    }
    const key = stack.join('/')
    if (interesting.has(key)) values.set(key, `${values.get(key) ?? ''}${token}`)
    else if (stack.length === 0 && token.trim() !== '') throw new Error('Maven Central POM has text outside the project element')
  }
  if (stack.length !== 0) throw new Error('Maven Central POM is not balanced XML')
  const value = (key) => values.get(key)?.trim() || null
  const modelVersion = value('project/modelVersion')
  const groupId = value('project/groupId') ?? value('project/parent/groupId')
  const artifactId = value('project/artifactId')
  const version = value('project/version') ?? value('project/parent/version')
  const packaging = value('project/packaging') ?? 'jar'
  if (modelVersion !== '4.0.0' || groupId !== expected.groupId || artifactId !== expected.artifactId || version !== expected.version) {
    throw new Error('Maven Central POM coordinates do not match the requested GAV')
  }
  if (packaging !== 'jar') throw new Error(`Maven Central release packaging is ${packaging}, not jar`)
  return { modelVersion, groupId, artifactId, version, packaging, coordinatesVerified: true }
}

function parseSha1Sidecar(bytes, field) {
  let value
  try { value = new TextDecoder('ascii', { fatal: true }).decode(bytes).trim() } catch { throw new Error(`Maven Central ${field} SHA-1 sidecar is not ASCII`) }
  if (!SHA1_PATTERN.test(value)) throw new Error(`Maven Central ${field} SHA-1 sidecar changed`)
  return value
}

function assertArmoredSignature(bytes) {
  let value
  try { value = new TextDecoder('ascii', { fatal: true }).decode(bytes).trim() } catch { throw new Error('Maven Central JAR signature is not ASCII armor') }
  if (!value.startsWith('-----BEGIN PGP SIGNATURE-----') || !value.endsWith('-----END PGP SIGNATURE-----')) {
    throw new Error('Maven Central JAR signature armor changed')
  }
}

function normalizeFile(role, path, bytes, checksumSource) {
  return {
    role,
    fileName: path.fileName,
    url: path.url,
    sizeBytes: bytes.byteLength,
    sha1: hash('sha1', bytes),
    sha256: hash('sha256', bytes),
    checksumSource,
  }
}

function expectedSha1Header(headers, sha1) {
  return headers?.get('x-checksum-sha1')?.toLowerCase() === sha1
}

export function normalizeMavenCentralJarRelease(payload, { input, headers = {}, observedAt = new Date().toISOString() } = {}) {
  const request = assertInput(input)
  const paths = artifactPaths(request)
  const pom = normalizeFile('pom', paths.pom, payload.pomBytes, 'central-sidecar-verified')
  const jar = normalizeFile('jar', paths.jar, payload.jarBytes, 'central-sidecar-verified')
  const signature = normalizeFile('jar-signature', paths.jarSignature, payload.signatureBytes, 'local-only')
  const declaredPomSha1 = parseSha1Sidecar(payload.pomSha1Bytes, 'POM')
  const declaredJarSha1 = parseSha1Sidecar(payload.jarSha1Bytes, 'JAR')
  if (declaredPomSha1 !== pom.sha1) throw new Error('Maven Central POM SHA-1 sidecar does not match downloaded bytes')
  if (declaredJarSha1 !== jar.sha1) throw new Error('Maven Central JAR SHA-1 sidecar does not match downloaded bytes')
  assertArmoredSignature(payload.signatureBytes)
  const pomModel = parsePomCoordinates(payload.pomBytes, request)
  const files = [pom, jar, signature]
  const semanticProjection = {
    source: { id: 'maven-central-public-jar-release', repositoryOrigin: MAVEN_CENTRAL_ORIGIN, repositoryRoot: MAVEN_CENTRAL_ROOT, endpointTemplate: RELEASE_ENDPOINT_TEMPLATE },
    request,
    release: {
      gav: `${request.groupId}:${request.artifactId}:${request.version}`,
      groupId: request.groupId,
      artifactId: request.artifactId,
      version: request.version,
      packaging: pomModel.packaging,
      repositoryPath: paths.repositoryPath,
      pomModelVersion: pomModel.modelVersion,
      pomCoordinatesVerified: pomModel.coordinatesVerified,
      fileCount: files.length,
      totalPayloadBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      files,
      signaturePresent: true,
      signatureCryptographicallyVerified: false,
    },
    access: { authentication: 'none', httpGetCount: 5, checksumSidecarCount: 2, downloadedJarBytes: jar.sizeBytes, filesExecuted: false },
  }
  const assertions = [
    { id: 'exact-release-gav', passed: true },
    { id: 'pom-coordinate-and-packaging', passed: true },
    { id: 'mandatory-sha1-sidecars-verified', passed: true },
    { id: 'repository-sha1-headers', passed: expectedSha1Header(headers.pom, pom.sha1) && expectedSha1Header(headers.jar, jar.sha1) },
    { id: 'jar-signature-sidecar-present', passed: true },
    { id: 'bounded-five-get-access', passed: true },
    { id: 'personal-and-raw-fields-excluded', passed: true },
    { id: 'artifact-not-executed', passed: true },
  ]
  return {
    ...semanticProjection,
    observedAt,
    resultDigest: hash('sha256', JSON.stringify(semanticProjection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

async function readBoundedBytes(response, { maxBytes, allowedContentTypes, label }) {
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!allowedContentTypes.has(contentType)) throw new Error(`${label} returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) throw new Error(`${label} exceeds the response budget`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`${label} has no body`)
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`${label} exceeds the response budget`)
    }
    chunks.push(value)
  }
  if (declaredLength !== null && Number(declaredLength) !== total) throw new Error(`${label} Content-Length changed during transfer`)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function responseError(status, phase) {
  const code = status === 429 ? 'rate-limited' : [401, 403].includes(status) ? 'access-policy-blocked' : status === 404 ? 'not-found' : `http-${status}`
  return new MavenCentralPublicJarReleaseError(`Maven Central ${phase} failed: HTTP_${status}`, { code, httpStatus: status, phase })
}

export async function readPublicJarReleaseEvidence(input, {
  fetchImpl = fetch,
  timeoutMs = 20_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
} = {}) {
  const request = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const normalizedUserAgent = assertUserAgent(userAgent)
  const paths = artifactPaths(request)
  const definitions = [
    ['pomBytes', paths.pom, MAX_POM_BYTES, new Set(['text/xml', 'application/xml', 'application/octet-stream']), 'POM'],
    ['pomSha1Bytes', paths.pomSha1, MAX_CHECKSUM_BYTES, new Set(['text/plain', 'application/octet-stream']), 'POM SHA-1 sidecar'],
    ['jarBytes', paths.jar, MAX_JAR_BYTES, new Set(['application/java-archive', 'application/octet-stream']), 'JAR'],
    ['jarSha1Bytes', paths.jarSha1, MAX_CHECKSUM_BYTES, new Set(['text/plain', 'application/octet-stream']), 'JAR SHA-1 sidecar'],
    ['signatureBytes', paths.jarSignature, MAX_SIGNATURE_BYTES, new Set(['text/plain', 'application/pgp-signature', 'application/octet-stream']), 'JAR signature sidecar'],
  ]
  const payload = {}
  const responseHeaders = {}
  for (const [key, artifact, maxBytes, allowedContentTypes, label] of definitions) {
    const response = await fetchImpl(artifact.url, {
      method: 'GET',
      headers: { accept: '*/*', 'user-agent': normalizedUserAgent },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw responseError(response.status, label)
    payload[key] = await readBoundedBytes(response, { maxBytes, allowedContentTypes, label: `Maven Central ${label}` })
    if (key === 'pomBytes') responseHeaders.pom = response.headers
    if (key === 'jarBytes') responseHeaders.jar = response.headers
  }
  return normalizeMavenCentralJarRelease(payload, { input: request, headers: responseHeaders, observedAt: now().toISOString() })
}

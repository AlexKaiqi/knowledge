import { createHash } from 'node:crypto'

export const TOKEN_ORIGIN = 'https://auth.docker.io'
export const REGISTRY_ORIGIN = 'https://registry-1.docker.io'
export const TOKEN_ENDPOINT = `${TOKEN_ORIGIN}/token`
export const MANIFEST_ENDPOINT_TEMPLATE = `${REGISTRY_ORIGIN}/v2/{repository}/manifests/{manifestDigest}`
export const MAX_TOKEN_RESPONSE_BYTES = 64 * 1024
export const MAX_MANIFEST_RESPONSE_BYTES = 4 * 1024 * 1024
export const MAX_DESCRIPTORS = 256

export const ACCEPTED_MANIFEST_MEDIA_TYPES = Object.freeze([
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
])

const ACCEPT_HEADER = ACCEPTED_MANIFEST_MEDIA_TYPES.join(', ')
const INDEX_MEDIA_TYPES = new Set(ACCEPTED_MANIFEST_MEDIA_TYPES.slice(0, 2))
const IMAGE_MEDIA_TYPES = new Set(ACCEPTED_MANIFEST_MEDIA_TYPES.slice(2))
const ALLOWED_INPUT_KEYS = new Set(['repository', 'manifestDigest'])
const REPOSITORY_COMPONENT_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\+[a-z0-9][a-z0-9!#$&^_.+-]*)?$/i
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export class DockerHubPublicImageManifestError extends Error {
  constructor(message, { code, httpStatus = null } = {}) {
    super(message)
    this.name = 'DockerHubPublicImageManifestError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.repository !== 'string' || input.repository.length > 255) throw new Error('repository must be a Docker Hub namespace/name no longer than 255 characters')
  const components = input.repository.split('/')
  if (components.length !== 2 || !components.every((component) => component.length <= 128 && REPOSITORY_COMPONENT_PATTERN.test(component))) {
    throw new Error('repository must be a lowercase Docker Hub namespace/name using the supported safe identifier subset')
  }
  if (typeof input.manifestDigest !== 'string' || !DIGEST_PATTERN.test(input.manifestDigest)) {
    throw new Error('manifestDigest must be an exact lowercase sha256 digest')
  }
  return { repository: input.repository, manifestDigest: input.manifestDigest }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function boundedText(value, field, maxLength = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Docker Hub ${field} shape changed`)
  }
  return value
}

function mediaType(value, field) {
  const normalized = boundedText(value, field, 256).toLowerCase()
  if (!MEDIA_TYPE_PATTERN.test(normalized)) throw new Error(`Docker Hub ${field} media type changed`)
  return normalized
}

function normalizeDigest(value, field) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) throw new Error(`Docker Hub ${field} digest changed`)
  return value
}

function sizeBytes(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Docker Hub ${field} size changed`)
  return value
}

function normalizeOptionalStringArray(value, field) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 32) throw new Error(`Docker Hub ${field} changed`)
  return value.map((entry) => boundedText(entry, field, 128))
}

function normalizePlatform(value) {
  if (value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Docker Hub descriptor platform changed')
  return {
    architecture: boundedText(value.architecture, 'platform architecture', 128),
    os: boundedText(value.os, 'platform os', 128),
    osVersion: value['os.version'] === undefined ? null : boundedText(value['os.version'], 'platform os.version', 256),
    osFeatures: normalizeOptionalStringArray(value['os.features'], 'platform os.features'),
    variant: value.variant === undefined ? null : boundedText(value.variant, 'platform variant', 128),
  }
}

function normalizeDescriptorBase(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Docker Hub ${field} descriptor changed`)
  return {
    mediaType: mediaType(value.mediaType, `${field} mediaType`),
    digest: normalizeDigest(value.digest, field),
    sizeBytes: sizeBytes(value.size, field),
  }
}

function normalizeIndexDescriptor(value) {
  const descriptor = normalizeDescriptorBase(value, 'index')
  const platform = normalizePlatform(value.platform)
  const annotationType = value.annotations?.['vnd.docker.reference.type']
  const annotationDigest = value.annotations?.['vnd.docker.reference.digest']
  if (annotationType !== undefined && typeof annotationType !== 'string') throw new Error('Docker Hub descriptor reference type changed')
  const referencedDigest = annotationDigest === undefined ? null : normalizeDigest(annotationDigest, 'referenced manifest')
  const role = annotationType === 'attestation-manifest'
    ? 'attestation'
    : platform && platform.os !== 'unknown' && platform.architecture !== 'unknown'
      ? 'image'
      : 'unknown'
  if (role === 'attestation' && referencedDigest === null) throw new Error('Docker Hub attestation descriptor lost its referenced manifest digest')
  return { role, ...descriptor, platform, referencedDigest }
}

function normalizeImageDescriptor(value, role) {
  return { role, ...normalizeDescriptorBase(value, role), platform: null, referencedDigest: null }
}

function addSizes(descriptors) {
  let total = 0
  for (const descriptor of descriptors) {
    total += descriptor.sizeBytes
    if (!Number.isSafeInteger(total)) throw new Error('Docker Hub declared referenced size exceeds the safe integer range')
  }
  return total
}

function normalizeManifest(payload, mediaTypeValue) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 2) throw new Error('Docker Hub manifest schema changed')
  if (payload.artifactType !== undefined) throw new Error('Docker Hub response is an OCI artifact, not a container image manifest')
  if (mediaType(payload.mediaType, 'manifest mediaType') !== mediaTypeValue) throw new Error('Docker Hub manifest body media type does not match Content-Type')
  let kind
  let descriptors
  if (INDEX_MEDIA_TYPES.has(mediaTypeValue)) {
    kind = 'image-index'
    if (!Array.isArray(payload.manifests) || payload.manifests.length < 1 || payload.manifests.length > MAX_DESCRIPTORS) {
      throw new Error('Docker Hub image index exceeds the bounded descriptor shape')
    }
    descriptors = payload.manifests.map(normalizeIndexDescriptor)
  } else if (IMAGE_MEDIA_TYPES.has(mediaTypeValue)) {
    kind = 'image-manifest'
    if (!Array.isArray(payload.layers) || payload.layers.length < 1 || payload.layers.length + 1 > MAX_DESCRIPTORS) {
      throw new Error('Docker Hub image manifest exceeds the bounded descriptor shape')
    }
    descriptors = [normalizeImageDescriptor(payload.config, 'config'), ...payload.layers.map((layer) => normalizeImageDescriptor(layer, 'layer'))]
  } else {
    throw new Error('Docker Hub returned an unsupported manifest media type')
  }
  return {
    kind,
    schemaVersion: 2,
    mediaType: mediaTypeValue,
    descriptorCount: descriptors.length,
    declaredReferencedBytes: addSizes(descriptors),
    descriptorSetDigest: sha256(JSON.stringify(descriptors)),
    descriptors,
  }
}

function parseRateLimit(headers) {
  const limit = headers.get('ratelimit-limit')
  const remaining = headers.get('ratelimit-remaining')
  if (limit === null && remaining === null) return { value: null, valid: true }
  const limitMatch = limit?.match(/^(\d+);w=(\d+)$/)
  const remainingMatch = remaining?.match(/^(\d+);w=(\d+)$/)
  if (!limitMatch || !remainingMatch || limitMatch[2] !== remainingMatch[2]) return { value: null, valid: false }
  const value = { limit: Number(limitMatch[1]), remaining: Number(remainingMatch[1]), windowSeconds: Number(limitMatch[2]) }
  if (!Object.values(value).every(Number.isSafeInteger) || value.limit < 0 || value.remaining < 0 || value.remaining > value.limit || value.windowSeconds < 1) {
    return { value: null, valid: false }
  }
  return { value, valid: true }
}

async function readBoundedBytes(response, { maxBytes, label, allowedMediaTypes }) {
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!allowedMediaTypes.has(contentType)) throw new Error(`${label} returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) throw new Error(`${label} exceeds the response budget`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`${label} has no body`)
  const chunks = []
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > maxBytes) {
      await reader.cancel()
      throw new Error(`${label} exceeds the response budget`)
    }
    chunks.push(value)
  }
  if (declaredLength !== null && Number(declaredLength) !== receivedBytes) throw new Error(`${label} Content-Length changed during transfer`)
  const bytes = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, contentType }
}

function parseJsonBytes(bytes, label) {
  let source
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error(`${label} is not valid UTF-8`) }
  try { return JSON.parse(source) } catch { throw new Error(`${label} is not valid JSON`) }
}

function normalizeToken(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Docker Hub anonymous token response shape changed')
  if (payload.refresh_token !== undefined) throw new Error('Docker Hub returned an unexpected refresh token')
  const token = payload.token ?? payload.access_token
  if (payload.token !== undefined && payload.access_token !== undefined && payload.token !== payload.access_token) throw new Error('Docker Hub returned conflicting access tokens')
  if (typeof token !== 'string' || token.length < 16 || token.length > 16_384 || /[\u0000-\u001f\u007f]/.test(token)) throw new Error('Docker Hub anonymous bearer token shape changed')
  if (payload.expires_in !== undefined && (!Number.isSafeInteger(payload.expires_in) || payload.expires_in < 60 || payload.expires_in > 86_400)) {
    throw new Error('Docker Hub anonymous bearer token lifetime changed')
  }
  return token
}

export function normalizeDockerHubManifestResponse(sourceBytes, { input, headers = new Headers(), observedAt = new Date().toISOString() } = {}) {
  const request = assertInput(input)
  const bytes = sourceBytes instanceof Uint8Array ? sourceBytes : new TextEncoder().encode(sourceBytes)
  if (bytes.byteLength > MAX_MANIFEST_RESPONSE_BYTES) throw new Error('Docker Hub manifest response exceeds the response budget')
  const localDigest = `sha256:${sha256(bytes)}`
  if (localDigest !== request.manifestDigest) throw new Error('Docker Hub manifest body digest does not match the requested digest')
  const headerDigest = headers.get('docker-content-digest')
  if (headerDigest !== request.manifestDigest) throw new Error('Docker Hub canonical manifest digest header changed')
  const contentType = (headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!ACCEPTED_MANIFEST_MEDIA_TYPES.includes(contentType)) throw new Error('Docker Hub returned an unsupported manifest Content-Type')
  const normalized = normalizeManifest(parseJsonBytes(bytes, 'Docker Hub manifest response'), contentType)
  const rateLimit = parseRateLimit(headers)
  const semanticProjection = {
    source: {
      id: 'docker-hub-public-image-manifest',
      registryOrigin: REGISTRY_ORIGIN,
      tokenOrigin: TOKEN_ORIGIN,
      endpointTemplate: MANIFEST_ENDPOINT_TEMPLATE,
    },
    request,
    manifest: {
      repository: request.repository,
      digest: request.manifestDigest,
      bodySizeBytes: bytes.byteLength,
      ...normalized,
    },
    access: {
      authentication: 'anonymous-bearer-token',
      manifestGetCount: 1,
      blobsDownloaded: false,
    },
  }
  const assertions = [
    { id: 'exact-local-manifest-digest', passed: true },
    { id: 'canonical-digest-header', passed: true },
    { id: 'registry-v2-api', passed: headers.get('docker-distribution-api-version')?.toLowerCase() === 'registry/2.0' },
    { id: 'supported-schema-two-manifest', passed: true },
    { id: 'bounded-complete-descriptor-surface', passed: normalized.descriptorCount <= MAX_DESCRIPTORS },
    { id: 'rate-limit-header-contract', passed: rateLimit.valid },
    { id: 'no-layer-download', passed: true },
    { id: 'mutable-and-personal-fields-excluded', passed: true },
  ]
  return {
    ...semanticProjection,
    rateLimit: rateLimit.value,
    observedAt,
    resultDigest: sha256(JSON.stringify(semanticProjection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

function responseError(status, phase) {
  const code = status === 429 ? 'rate-limited' : [401, 403].includes(status) ? 'access-policy-blocked' : status === 404 ? 'not-found' : `http-${status}`
  return new DockerHubPublicImageManifestError(`Docker Hub ${phase} failed: HTTP_${status}`, { code, httpStatus: status })
}

export async function readPublicImageManifestByDigest(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
} = {}) {
  const request = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const normalizedUserAgent = assertUserAgent(userAgent)
  const tokenUrl = new URL('/token', TOKEN_ORIGIN)
  tokenUrl.searchParams.set('service', 'registry.docker.io')
  tokenUrl.searchParams.set('scope', `repository:${request.repository}:pull`)
  const tokenResponse = await fetchImpl(tokenUrl, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': normalizedUserAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!tokenResponse.ok) throw responseError(tokenResponse.status, 'anonymous token exchange')
  const tokenPayload = await readBoundedBytes(tokenResponse, {
    maxBytes: MAX_TOKEN_RESPONSE_BYTES,
    label: 'Docker Hub anonymous token response',
    allowedMediaTypes: new Set(['application/json']),
  })
  const token = normalizeToken(parseJsonBytes(tokenPayload.bytes, 'Docker Hub anonymous token response'))

  const repositoryPath = request.repository.split('/').map(encodeURIComponent).join('/')
  const manifestUrl = new URL(`/v2/${repositoryPath}/manifests/${request.manifestDigest}`, REGISTRY_ORIGIN)
  const manifestResponse = await fetchImpl(manifestUrl, {
    method: 'GET',
    headers: { accept: ACCEPT_HEADER, authorization: `Bearer ${token}`, 'user-agent': normalizedUserAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!manifestResponse.ok) throw responseError(manifestResponse.status, 'manifest read')
  const manifestPayload = await readBoundedBytes(manifestResponse, {
    maxBytes: MAX_MANIFEST_RESPONSE_BYTES,
    label: 'Docker Hub manifest response',
    allowedMediaTypes: new Set(ACCEPTED_MANIFEST_MEDIA_TYPES),
  })
  return normalizeDockerHubManifestResponse(manifestPayload.bytes, { input: request, headers: manifestResponse.headers, observedAt: now().toISOString() })
}

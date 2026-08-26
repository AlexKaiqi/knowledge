import { createHash } from 'node:crypto'

export const HUGGING_FACE_ORIGIN = 'https://huggingface.co'
export const ENDPOINT_TEMPLATE = `${HUGGING_FACE_ORIGIN}/api/models/{repoId}/revision/{commitSha}?blobs=true`
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
export const MAX_FILES = 1024
export const MAX_TAGS = 256

const ALLOWED_INPUT_KEYS = new Set(['repoId', 'commitSha'])
const COMMIT_PATTERN = /^[a-f0-9]{40}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const REPO_SEGMENT_PATTERN = /^[A-Za-z0-9_](?:[A-Za-z0-9._-]{0,94}[A-Za-z0-9_])?$/
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export class HuggingFacePublicModelRevisionError extends Error {
  constructor(message, { code, httpStatus = null, retryAt = null } = {}) {
    super(message)
    this.name = 'HuggingFacePublicModelRevisionError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

function validRepoSegment(value) {
  return REPO_SEGMENT_PATTERN.test(value) && !value.includes('..') && !value.includes('--') && !value.endsWith('.git')
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.repoId !== 'string' || input.repoId.length > 96) throw new Error('repoId must be a namespace/name identifier no longer than 96 characters')
  const segments = input.repoId.split('/')
  if (segments.length !== 2 || !segments.every(validRepoSegment)) throw new Error('repoId must be an exact namespace/name using Hugging Face identifier characters')
  if (typeof input.commitSha !== 'string' || !COMMIT_PATTERN.test(input.commitSha)) throw new Error('commitSha must be a full lowercase 40-character commit hash')
  return { repoId: input.repoId, commitSha: input.commitSha }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function optionalText(value, field, maxLength = 256) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Hugging Face ${field} shape changed`)
  return value
}

function normalizeTags(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_TAGS) throw new Error('Hugging Face model tags exceed the bounded shape')
  const tags = value.map((tag) => {
    if (typeof tag !== 'string' || tag.length < 1 || tag.length > 256 || /[\u0000-\u001f\u007f]/.test(tag)) throw new Error('Hugging Face model tag shape changed')
    return tag
  })
  return [...new Set(tags)].sort()
}

function assertFilePath(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024 || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Hugging Face model file path is unsafe')
  }
  const segments = value.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) throw new Error('Hugging Face model file path is unsafe')
  return value
}

function normalizeFile(file) {
  const path = assertFilePath(file?.rfilename)
  if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`Hugging Face model file size changed: ${path}`)
  if (typeof file.blobId !== 'string' || !COMMIT_PATTERN.test(file.blobId)) throw new Error(`Hugging Face Git blob identity changed: ${path}`)
  let lfsSha256 = null
  let xetHash = null
  if (file.lfs !== undefined && file.lfs !== null) {
    if (!file.lfs || typeof file.lfs !== 'object' || Array.isArray(file.lfs) || !SHA256_PATTERN.test(file.lfs.sha256) || file.lfs.size !== file.size) {
      throw new Error(`Hugging Face LFS identity changed: ${path}`)
    }
    lfsSha256 = file.lfs.sha256
  }
  if (file.xetHash !== undefined && file.xetHash !== null) {
    if (typeof file.xetHash !== 'string' || !SHA256_PATTERN.test(file.xetHash)) throw new Error(`Hugging Face Xet identity changed: ${path}`)
    xetHash = file.xetHash
  }
  if (lfsSha256 && xetHash) throw new Error(`Hugging Face file exposes ambiguous LFS and Xet identities: ${path}`)
  return {
    path,
    sizeBytes: file.size,
    storage: lfsSha256 ? 'lfs' : xetHash ? 'xet' : 'git',
    gitBlobSha1: file.blobId,
    lfsSha256,
    xetHash,
  }
}

function normalizeFiles(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_FILES) throw new Error('Hugging Face model file manifest exceeds the bounded shape')
  const files = value.map(normalizeFile).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  if (new Set(files.map((file) => file.path)).size !== files.length) throw new Error('Hugging Face model file manifest contains duplicate paths')
  let totalSizeBytes = 0
  for (const file of files) {
    totalSizeBytes += file.sizeBytes
    if (!Number.isSafeInteger(totalSizeBytes)) throw new Error('Hugging Face model total size exceeds the safe integer range')
  }
  return { files, totalSizeBytes, fileManifestDigest: sha256(JSON.stringify(files)) }
}

function parseRateLimit(headers, now) {
  const rate = headers.get('ratelimit')
  const policy = headers.get('ratelimit-policy')
  const rateMatch = rate?.match(/^"([a-z0-9_-]+)";r=(\d+);t=(\d+)$/i)
  const policyMatch = policy?.match(/^"fixed window";"([a-z0-9_-]+)";q=(\d+);w=(\d+)$/i)
  if (!rateMatch || !policyMatch || rateMatch[1] !== policyMatch[1]) return null
  const remaining = Number(rateMatch[2])
  const resetAfterSeconds = Number(rateMatch[3])
  const limit = Number(policyMatch[2])
  const windowSeconds = Number(policyMatch[3])
  if (![remaining, resetAfterSeconds, limit, windowSeconds].every(Number.isSafeInteger)) return null
  return {
    bucket: rateMatch[1],
    limit,
    remaining,
    windowSeconds,
    resetAfterSeconds,
    resetAt: new Date(now.getTime() + resetAfterSeconds * 1000).toISOString(),
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`Hugging Face model revision read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('Hugging Face model revision response exceeds the 4 MiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Hugging Face model revision response has no body')
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
        throw new Error('Hugging Face model revision response exceeds the 4 MiB budget')
      }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error.message.includes('4 MiB budget')) throw error
    throw new Error('Hugging Face model revision response is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new Error('Hugging Face model revision response is not valid JSON') }
}

export function normalizePublicModelRevisionResponse(payload, { input, headers = new Headers(), observedAt = new Date().toISOString() } = {}) {
  const request = assertInput(input)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Hugging Face model response envelope changed')
  if (payload.id !== request.repoId || payload.modelId !== request.repoId || payload.sha !== request.commitSha) throw new Error('Hugging Face model revision identity changed')
  if (payload.private !== false) throw new Error('Hugging Face model revision is not public')
  if (payload.gated !== false) throw new Error('Hugging Face model revision requires an access gate')
  if (payload.disabled !== false) throw new Error('Hugging Face model revision is disabled')
  const manifest = normalizeFiles(payload.siblings)
  const semanticProjection = {
    source: {
      id: 'hugging-face-public-model-revision',
      apiOrigin: HUGGING_FACE_ORIGIN,
      endpointTemplate: ENDPOINT_TEMPLATE,
    },
    request,
    modelRevision: {
      repoId: payload.id,
      commitSha: payload.sha,
      visibility: 'public',
      gated: false,
      disabled: false,
      pipelineTag: optionalText(payload.pipeline_tag, 'pipeline_tag'),
      libraryName: optionalText(payload.library_name, 'library_name'),
      tags: normalizeTags(payload.tags),
      manifestComplete: true,
      fileCount: manifest.files.length,
      totalSizeBytes: manifest.totalSizeBytes,
      fileManifestDigest: manifest.fileManifestDigest,
      files: manifest.files,
    },
  }
  const rateLimit = parseRateLimit(headers, new Date(observedAt))
  const assertions = [
    { id: 'exact-repository-and-commit', passed: true },
    { id: 'public-ungated-enabled-model', passed: true },
    { id: 'complete-bounded-file-manifest', passed: semanticProjection.modelRevision.fileCount <= MAX_FILES },
    { id: 'file-integrity-identities', passed: semanticProjection.modelRevision.files.every((file) => COMMIT_PATTERN.test(file.gitBlobSha1)) },
    { id: 'official-api-rate-bucket', passed: rateLimit?.bucket === 'api' },
    { id: 'personal-and-popularity-fields-excluded', passed: !['author', 'downloads', 'likes', 'spaces', 'widgetData', 'cardData', 'raw'].some((field) => Object.hasOwn(semanticProjection.modelRevision, field)) },
  ]
  return {
    ...semanticProjection,
    rateLimit,
    observedAt,
    resultDigest: sha256(JSON.stringify(semanticProjection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicModelRevisionManifest(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
} = {}) {
  const request = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const normalizedUserAgent = assertUserAgent(userAgent)
  const [namespace, name] = request.repoId.split('/')
  const url = new URL(`/api/models/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/revision/${request.commitSha}`, HUGGING_FACE_ORIGIN)
  url.searchParams.set('blobs', 'true')
  const requestStartedAt = now()
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': normalizedUserAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const rateLimit = parseRateLimit(response.headers, requestStartedAt)
    const code = response.status === 429 ? 'rate-limited' : [401, 403].includes(response.status) ? 'access-policy-blocked' : response.status === 404 ? 'not-found' : `http-${response.status}`
    throw new HuggingFacePublicModelRevisionError(`Hugging Face model revision read failed: HTTP_${response.status}`, {
      code,
      httpStatus: response.status,
      retryAt: rateLimit?.resetAt ?? null,
    })
  }
  const observedAt = now().toISOString()
  return normalizePublicModelRevisionResponse(await readJsonResponse(response), { input: request, headers: response.headers, observedAt })
}

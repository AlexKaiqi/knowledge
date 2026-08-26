import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.github.com'
export const API_VERSION = '2026-03-10'
export const MAX_FILE_BYTES = 256 * 1024

const ALLOWED_INPUT_KEYS = new Set(['repository', 'path', 'revision'])
const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/
const REVISION_PATTERN = /^[a-f0-9]{40}$/
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40}$/

export class GitHubPublicRepositoryFileError extends Error {
  constructor(message, { code, httpStatus, rateLimitRemaining = null, rateLimitResetAt = null } = {}) {
    super(message)
    this.name = 'GitHubPublicRepositoryFileError'
    this.code = code
    this.httpStatus = httpStatus
    this.rateLimitRemaining = rateLimitRemaining
    this.rateLimitResetAt = rateLimitResetAt
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.repository !== 'string' || !REPOSITORY_PATTERN.test(input.repository)) throw new Error('repository must be a public GitHub owner/name identifier')
  if (typeof input.revision !== 'string' || !REVISION_PATTERN.test(input.revision)) throw new Error('revision must be a full lowercase 40-character Git commit id')
  if (typeof input.path !== 'string' || input.path.length < 1 || input.path.length > 512 || input.path.startsWith('/') || input.path.includes('\\') || /[\r\n]/.test(input.path)) {
    throw new Error('path must be a relative repository path between 1 and 512 characters')
  }
  const segments = input.path.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) throw new Error('path must not contain empty, dot, or parent segments')
  return { repository: input.repository, path: input.path, revision: input.revision }
}

function parseIntegerHeader(headers, name) {
  const value = headers.get(name)
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value)
}

function decodeBase64Utf8(content, expectedSize) {
  const compact = content.replaceAll(/\s/g, '')
  if (compact.length === 0 && expectedSize !== 0) throw new Error('GitHub repository content is unexpectedly empty')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) throw new Error('GitHub repository content is not valid base64')
  const bytes = Buffer.from(compact, 'base64')
  if (bytes.length !== expectedSize) throw new Error('GitHub repository content size does not match the response metadata')
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('GitHub repository content is not valid UTF-8 text')
  }
  if (text.includes('\u0000')) throw new Error('GitHub repository content appears to be binary')
  return { text, bytes }
}

function assertFilePayload(payload, input) {
  const valid = payload
    && !Array.isArray(payload)
    && payload.type === 'file'
    && payload.encoding === 'base64'
    && typeof payload.content === 'string'
    && Number.isInteger(payload.size)
    && payload.size >= 0
    && payload.size <= MAX_FILE_BYTES
    && payload.path === input.path
    && typeof payload.name === 'string'
    && GIT_OBJECT_PATTERN.test(payload.sha)
    && typeof payload.html_url === 'string'
    && typeof payload.url === 'string'
  if (!valid) throw new Error('GitHub repository content response is not a bounded file payload')
  const expectedHtmlPrefix = `https://github.com/${input.repository}/blob/${input.revision}/`
  if (!payload.html_url.startsWith(expectedHtmlPrefix)) throw new Error('GitHub repository content did not resolve at the requested immutable revision')
  const expectedApiPrefix = `${API_BASE_URL}/repos/${input.repository}/contents/`
  if (!payload.url.startsWith(expectedApiPrefix)) throw new Error('GitHub repository content response escaped the requested repository')
}

export function normalizePublicRepositoryFileResponse(payload, { input, headers = new Headers(), observedAt = new Date().toISOString() }) {
  const normalizedInput = assertInput(input)
  assertFilePayload(payload, normalizedInput)
  const { text, bytes } = decodeBase64Utf8(payload.content, payload.size)
  const selectedVersion = headers.get('x-github-api-version-selected')
  const rateLimitReset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  const assertions = [
    { id: 'response-shape', passed: true },
    { id: 'api-version', passed: selectedVersion === API_VERSION },
    { id: 'core-rate-bucket', passed: headers.get('x-ratelimit-resource') === 'core' },
    { id: 'immutable-revision', passed: payload.html_url.includes(`/blob/${normalizedInput.revision}/`) },
    { id: 'bounded-utf8-file', passed: bytes.length <= MAX_FILE_BYTES },
  ]
  const projection = {
    source: { id: 'github-public-repository-file', apiBaseUrl: API_BASE_URL, apiVersion: API_VERSION },
    request: normalizedInput,
    file: {
      name: payload.name,
      path: payload.path,
      gitBlobId: payload.sha,
      sizeBytes: bytes.length,
      htmlUrl: payload.html_url,
      content: text,
      contentSha256: digest(bytes),
    },
  }
  return {
    ...projection,
    rateLimit: {
      resource: headers.get('x-ratelimit-resource'),
      limit: parseIntegerHeader(headers, 'x-ratelimit-limit'),
      remaining: parseIntegerHeader(headers, 'x-ratelimit-remaining'),
      resetAt: rateLimitReset === null ? null : new Date(rateLimitReset * 1000).toISOString(),
    },
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicRepositoryFile(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  const [owner, repository] = normalizedInput.repository.split('/')
  const encodedPath = normalizedInput.path.split('/').map(encodeURIComponent).join('/')
  const url = new URL(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`, API_BASE_URL)
  url.searchParams.set('ref', normalizedInput.revision)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': API_VERSION,
      'user-agent': userAgent,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    const reset = response.headers.get('x-ratelimit-reset')
    const resetAt = reset !== null && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null
    throw new GitHubPublicRepositoryFileError(
      `GitHub repository content read failed: HTTP_${response.status}; rateLimitRemaining=${remaining ?? 'unknown'}; rateLimitReset=${reset ?? 'unknown'}`,
      {
        code: (response.status === 403 || response.status === 429) && remaining === '0' ? 'rate-limited' : `http-${response.status}`,
        httpStatus: response.status,
        rateLimitRemaining: remaining !== null && /^\d+$/.test(remaining) ? Number(remaining) : null,
        rateLimitResetAt: resetAt,
      },
    )
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`GitHub repository content read returned ${contentType || 'no content type'}`)
  return normalizePublicRepositoryFileResponse(await response.json(), { input: normalizedInput, headers: response.headers, observedAt: now().toISOString() })
}

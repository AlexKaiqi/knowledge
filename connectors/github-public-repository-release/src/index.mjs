import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.github.com'
export const API_VERSION = '2026-03-10'
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const MAX_ASSETS = 64
export const MAX_NOTES_EXCERPT_CHARACTERS = 4096

const ALLOWED_INPUT_KEYS = new Set(['owner', 'repository', 'tagName'])
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/

const digest = (value) => createHash('sha256').update(value).digest('hex')

export class GitHubPublicRepositoryReleaseError extends Error {
  constructor(message, { code, httpStatus, retryAt = null } = {}) {
    super(message)
    this.name = 'GitHubPublicRepositoryReleaseError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

function validTagName(value) {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 255
    && !/[\u0000-\u0020\u007f~^:?*[\\]/.test(value)
    && !value.includes('..')
    && !value.includes('@{')
    && !value.includes('//')
    && !value.startsWith('.')
    && !value.startsWith('/')
    && !value.endsWith('.')
    && !value.endsWith('/')
    && !value.endsWith('.lock')
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.owner !== 'string' || !OWNER_PATTERN.test(input.owner)) throw new Error('owner must be a bounded GitHub owner name')
  if (typeof input.repository !== 'string' || !REPOSITORY_PATTERN.test(input.repository) || input.repository === '.' || input.repository === '..' || input.repository.toLowerCase().endsWith('.git')) {
    throw new Error('repository must be a bounded GitHub repository name without .git')
  }
  if (!validTagName(input.tagName)) throw new Error('tagName must be one exact bounded Git ref name')
  return { owner: input.owner, repository: input.repository, tagName: input.tagName }
}

function optionalString(value, field, { maxLength = 4096 } = {}) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength || /\u0000/.test(value)) throw new Error(`GitHub release ${field} shape changed`)
  return value
}

function timestamp(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`GitHub release ${field} shape changed`)
  return new Date(value).toISOString()
}

function decodedPath(url, field) {
  try { return decodeURIComponent(url.pathname) } catch { throw new Error(`GitHub release ${field} URL is invalid`) }
}

function normalizeReleaseUrl(value, input) {
  let url
  try { url = new URL(value) } catch { throw new Error('GitHub release HTML URL is invalid') }
  const expectedPath = `/${input.owner}/${input.repository}/releases/tag/${input.tagName}`.toLowerCase()
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash || decodedPath(url, 'HTML').toLowerCase() !== expectedPath) {
    throw new Error('GitHub release HTML URL escaped the requested repository tag')
  }
  return url.href
}

function normalizeAsset(asset, input) {
  const valid = asset
    && typeof asset === 'object'
    && !Array.isArray(asset)
    && typeof asset.name === 'string'
    && asset.name.length >= 1
    && asset.name.length <= 255
    && !/[\/\\\u0000-\u001f\u007f]/.test(asset.name)
    && typeof asset.state === 'string'
    && asset.state.length >= 1
    && asset.state.length <= 32
    && typeof asset.content_type === 'string'
    && asset.content_type.length >= 1
    && asset.content_type.length <= 255
    && Number.isInteger(asset.size)
    && asset.size >= 0
  if (!valid) throw new Error('GitHub release asset shape changed')
  if (asset.digest !== null && asset.digest !== undefined && !SHA256_DIGEST_PATTERN.test(asset.digest)) throw new Error('GitHub release asset digest shape changed')
  let downloadUrl
  try { downloadUrl = new URL(asset.browser_download_url) } catch { throw new Error('GitHub release asset download URL is invalid') }
  const expectedPath = `/${input.owner}/${input.repository}/releases/download/${input.tagName}/${asset.name}`.toLowerCase()
  if (downloadUrl.protocol !== 'https:' || downloadUrl.hostname !== 'github.com' || downloadUrl.username || downloadUrl.password || downloadUrl.search || downloadUrl.hash || decodedPath(downloadUrl, 'asset download').toLowerCase() !== expectedPath) {
    throw new Error('GitHub release asset download URL escaped the requested repository tag')
  }
  return {
    name: asset.name,
    label: optionalString(asset.label, 'asset label', { maxLength: 512 }),
    state: asset.state,
    contentType: asset.content_type,
    sizeBytes: asset.size,
    sha256: asset.digest ? asset.digest.slice('sha256:'.length) : null,
    downloadUrl: downloadUrl.href,
    createdAt: timestamp(asset.created_at, 'asset created_at'),
    updatedAt: timestamp(asset.updated_at, 'asset updated_at'),
  }
}

function normalizeNotes(value) {
  if (value === null || value === undefined || value === '') return { characterCount: 0, sha256: null, excerpt: null, truncated: false }
  if (typeof value !== 'string' || /\u0000/.test(value)) throw new Error('GitHub release body shape changed')
  const characters = [...value]
  return {
    characterCount: characters.length,
    sha256: digest(value),
    excerpt: characters.slice(0, MAX_NOTES_EXCERPT_CHARACTERS).join(''),
    truncated: characters.length > MAX_NOTES_EXCERPT_CHARACTERS,
  }
}

function parseIntegerHeader(headers, name) {
  const value = headers.get(name)
  return value !== null && /^\d+$/.test(value) ? Number(value) : null
}

function parseRetryAt(headers, observedAt) {
  const retryAfter = headers.get('retry-after')
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) return new Date(observedAt.getTime() + Number(retryAfter) * 1000).toISOString()
  if (retryAfter !== null && Number.isFinite(Date.parse(retryAfter))) return new Date(retryAfter).toISOString()
  const reset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  return reset === null ? null : new Date(reset * 1000).toISOString()
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`GitHub repository release returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('GitHub repository release response exceeds the 2 MiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GitHub repository release response has no body')
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
        throw new Error('GitHub repository release response exceeds the 2 MiB budget')
      }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error.message.includes('2 MiB budget')) throw error
    throw new Error('GitHub repository release response is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new Error('GitHub repository release response is not valid JSON') }
}

export function normalizePublicRepositoryReleaseResponse(payload, { input, headers = new Headers(), observedAt = new Date().toISOString() } = {}) {
  const normalizedInput = assertInput(input)
  const valid = payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
    && payload.tag_name === normalizedInput.tagName
    && typeof payload.draft === 'boolean'
    && typeof payload.prerelease === 'boolean'
    && (payload.immutable === undefined || typeof payload.immutable === 'boolean')
    && Array.isArray(payload.assets)
    && payload.assets.length <= MAX_ASSETS
  if (!valid) throw new Error('GitHub repository release identity or bounded shape changed')
  if (payload.draft) throw new Error('GitHub public repository release unexpectedly returned a draft')
  const assets = payload.assets.map((asset) => normalizeAsset(asset, normalizedInput)).sort((left, right) => left.name.localeCompare(right.name))
  if (new Set(assets.map((asset) => asset.name)).size !== assets.length) throw new Error('GitHub repository release contains duplicate asset names')
  const notes = normalizeNotes(payload.body)
  const projection = {
    source: {
      id: 'github-public-repository-release',
      endpointTemplate: `${API_BASE_URL}/repos/{owner}/{repository}/releases/tags/{tag}`,
      apiVersion: API_VERSION,
    },
    request: normalizedInput,
    repositoryUrl: `https://github.com/${normalizedInput.owner}/${normalizedInput.repository}`,
    release: {
      tagName: payload.tag_name,
      targetCommitish: optionalString(payload.target_commitish, 'target_commitish', { maxLength: 255 }),
      name: optionalString(payload.name, 'name', { maxLength: 1024 }),
      prerelease: payload.prerelease,
      immutable: payload.immutable ?? false,
      createdAt: timestamp(payload.created_at, 'created_at'),
      publishedAt: timestamp(payload.published_at, 'published_at', { nullable: true }),
      url: normalizeReleaseUrl(payload.html_url, normalizedInput),
      notes,
      assetCoverage: {
        representation: 'embedded-release-assets',
        returnedCount: assets.length,
        maximumAssets: MAX_ASSETS,
        completeness: 'not-asserted',
        sha256Count: assets.filter((asset) => asset.sha256 !== null).length,
      },
      assets,
    },
  }
  const reset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  const rateLimit = {
    resource: headers.get('x-ratelimit-resource'),
    limit: parseIntegerHeader(headers, 'x-ratelimit-limit'),
    remaining: parseIntegerHeader(headers, 'x-ratelimit-remaining'),
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
  }
  const assertions = [
    { id: 'exact-release-tag', passed: true },
    { id: 'public-non-draft', passed: payload.draft === false },
    { id: 'api-version', passed: headers.get('x-github-api-version-selected') === API_VERSION },
    { id: 'core-rate-bucket', passed: rateLimit.resource === 'core' },
    { id: 'etag-present', passed: Boolean(headers.get('etag')) },
    { id: 'bounded-assets', passed: assets.length <= MAX_ASSETS },
    { id: 'uploaded-assets', passed: assets.every((asset) => asset.state === 'uploaded') },
    { id: 'personal-fields-excluded', passed: !['author', 'uploader', 'downloadCount'].some((field) => JSON.stringify(projection).includes(`"${field}"`)) },
    { id: 'archive-links-excluded', passed: !['tarballUrl', 'zipballUrl'].some((field) => JSON.stringify(projection).includes(`"${field}"`)) },
  ]
  return {
    ...projection,
    registryState: { etag: headers.get('etag'), rateLimit },
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicRepositoryReleaseByTag(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  if (typeof userAgent !== 'string' || userAgent.length < 1 || userAgent.length > 128 || /[\r\n]/.test(userAgent)) throw new Error('userAgent must be a single-line string between 1 and 128 characters')
  const url = new URL(`/repos/${encodeURIComponent(normalizedInput.owner)}/${encodeURIComponent(normalizedInput.repository)}/releases/tags/${encodeURIComponent(normalizedInput.tagName)}`, API_BASE_URL)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': API_VERSION, 'user-agent': userAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const rateLimited = response.status === 403 || response.status === 429
    throw new GitHubPublicRepositoryReleaseError(
      `GitHub repository release failed: HTTP_${response.status}; rateLimitRemaining=${response.headers.get('x-ratelimit-remaining') ?? 'unknown'}; rateLimitReset=${response.headers.get('x-ratelimit-reset') ?? 'unknown'}`,
      { code: rateLimited ? 'rate-limited' : response.status === 404 ? 'release-not-found' : `http-${response.status}`, httpStatus: response.status, retryAt: parseRetryAt(response.headers, now()) },
    )
  }
  return normalizePublicRepositoryReleaseResponse(await readJsonResponse(response), { input: normalizedInput, headers: response.headers, observedAt: now().toISOString() })
}

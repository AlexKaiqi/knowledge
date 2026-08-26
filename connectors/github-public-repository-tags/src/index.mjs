import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.github.com'
export const API_VERSION = '2026-03-10'
export const MAX_TAGS = 500
export const PAGE_SIZE = 100
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

const ALLOWED_INPUT_KEYS = new Set(['owner', 'repository', 'maxTags'])
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const SHA_PATTERN = /^[a-f0-9]{40}$/

export class GitHubPublicRepositoryTagsError extends Error {
  constructor(message, { code, httpStatus, retryAt = null } = {}) {
    super(message)
    this.name = 'GitHubPublicRepositoryTagsError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex')

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.owner !== 'string' || !OWNER_PATTERN.test(input.owner)) throw new Error('owner must be a bounded GitHub owner name')
  if (typeof input.repository !== 'string' || !REPOSITORY_PATTERN.test(input.repository) || input.repository === '.' || input.repository === '..' || input.repository.toLowerCase().endsWith('.git')) throw new Error('repository must be a bounded GitHub repository name without .git')
  const maxTags = input.maxTags ?? 200
  if (!Number.isInteger(maxTags) || maxTags < 1 || maxTags > MAX_TAGS) throw new Error(`maxTags must be an integer between 1 and ${MAX_TAGS}`)
  return { owner: input.owner, repository: input.repository, maxTags }
}

export function parsePublicGitHubRepositoryUrl(repositoryUrl) {
  let url
  try { url = new URL(repositoryUrl) } catch { throw new Error('repositoryUrl must be a public GitHub repository URL') }
  const segments = url.pathname.replace(/\.git$/i, '').split('/').filter(Boolean)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || segments.length !== 2) {
    throw new Error('repositoryUrl must be a public GitHub repository URL')
  }
  const { owner, repository } = assertInput({ owner: segments[0], repository: segments[1] })
  return { owner, repository }
}

function parseIntegerHeader(headers, name) {
  const value = headers.get(name)
  return value !== null && /^\d+$/.test(value) ? Number(value) : null
}

function parseRetryAt(headers, observedAt) {
  const reset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  if (reset !== null) return new Date(reset * 1000).toISOString()
  const retryAfter = headers.get('retry-after')
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) return new Date(observedAt.getTime() + Number(retryAfter) * 1000).toISOString()
  if (retryAfter !== null && Number.isFinite(Date.parse(retryAfter))) return new Date(retryAfter).toISOString()
  return null
}

function hasNextPage(linkHeader) {
  return typeof linkHeader === 'string' && linkHeader.split(',').some((part) => /;\s*rel="next"\s*$/.test(part.trim()))
}

function normalizeTag(item, input) {
  const valid = item
    && typeof item === 'object'
    && !Array.isArray(item)
    && typeof item.name === 'string'
    && item.name.length >= 1
    && item.name.length <= 1024
    && !/[\u0000-\u001f\u007f]/.test(item.name)
    && item.commit
    && typeof item.commit === 'object'
    && SHA_PATTERN.test(item.commit.sha)
    && typeof item.commit.url === 'string'
  if (!valid) throw new Error('GitHub repository tag response shape changed')
  let commitUrl
  try { commitUrl = new URL(item.commit.url) } catch { throw new Error('GitHub repository tag commit URL is invalid') }
  const expectedPath = `/repos/${input.owner}/${input.repository}/commits/${item.commit.sha}`.toLowerCase()
  if (commitUrl.protocol !== 'https:' || commitUrl.hostname !== 'api.github.com' || commitUrl.username || commitUrl.password || commitUrl.search || commitUrl.hash || commitUrl.pathname.toLowerCase() !== expectedPath) {
    throw new Error('GitHub repository tag commit URL escaped the requested repository')
  }
  return { name: item.name, commitSha: item.commit.sha }
}

export function normalizeRepositoryTagPage(payload, { input, page, perPage, headers = new Headers() }) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(page) || page < 1 || page > Math.ceil(normalizedInput.maxTags / PAGE_SIZE)) throw new Error('page is outside the bounded request')
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > PAGE_SIZE) throw new Error('perPage is outside the bounded request')
  if (!Array.isArray(payload) || payload.length > perPage) throw new Error('GitHub repository tag page shape changed')
  const tags = payload.map((item) => normalizeTag(item, normalizedInput))
  if (new Set(tags.map((tag) => tag.name)).size !== tags.length) throw new Error('GitHub repository tag page contains duplicate names')
  const rateLimitReset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  return {
    tags,
    pageHasNext: hasNextPage(headers.get('link')),
    selectedApiVersion: headers.get('x-github-api-version-selected'),
    rateLimit: {
      resource: headers.get('x-ratelimit-resource'),
      limit: parseIntegerHeader(headers, 'x-ratelimit-limit'),
      remaining: parseIntegerHeader(headers, 'x-ratelimit-remaining'),
      resetAt: rateLimitReset === null ? null : new Date(rateLimitReset * 1000).toISOString(),
    },
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`GitHub repository tags returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('GitHub repository tag page exceeds the 2 MiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GitHub repository tag page has no response body')
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
        throw new Error('GitHub repository tag page exceeds the 2 MiB budget')
      }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error.message.includes('2 MiB budget')) throw error
    throw new Error('GitHub repository tag page is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new Error('GitHub repository tag page is not valid JSON') }
}

export async function listPublicRepositoryTags(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  if (typeof userAgent !== 'string' || userAgent.length < 1 || userAgent.length > 128 || /[\r\n]/.test(userAgent)) throw new Error('userAgent must be a single-line string between 1 and 128 characters')
  const pages = []
  const tags = []
  let page = 1
  let pageHasNext = true
  while (tags.length < normalizedInput.maxTags && pageHasNext) {
    const perPage = Math.min(PAGE_SIZE, normalizedInput.maxTags - tags.length)
    const url = new URL(`/repos/${encodeURIComponent(normalizedInput.owner)}/${encodeURIComponent(normalizedInput.repository)}/tags`, API_BASE_URL)
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('page', String(page))
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
      const rateLimited = response.status === 403 || response.status === 429
      throw new GitHubPublicRepositoryTagsError(
        `GitHub repository tags failed: HTTP_${response.status}; rateLimitRemaining=${remaining ?? 'unknown'}; rateLimitReset=${response.headers.get('x-ratelimit-reset') ?? 'unknown'}`,
        { code: rateLimited ? 'rate-limited' : `http-${response.status}`, httpStatus: response.status, retryAt: parseRetryAt(response.headers, now()) },
      )
    }
    const normalizedPage = normalizeRepositoryTagPage(await readJsonResponse(response), { input: normalizedInput, page, perPage, headers: response.headers })
    pages.push(normalizedPage)
    tags.push(...normalizedPage.tags)
    pageHasNext = normalizedPage.pageHasNext
    page += 1
  }
  if (new Set(tags.map((tag) => tag.name)).size !== tags.length) throw new Error('GitHub repository tag pagination returned duplicate names')
  const sortedTags = tags.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  const tagSetComplete = !pageHasNext
  const tagSetDigest = digest(sortedTags.map((tag) => `refs/tags/${tag.name}\t${tag.commitSha}`).join('\n'))
  const coverage = {
    representation: 'bounded-tag-set',
    returnedCount: sortedTags.length,
    requestsMade: pages.length,
    perRequestLimit: PAGE_SIZE,
    maximumTags: normalizedInput.maxTags,
    tagSetComplete,
    truncated: !tagSetComplete,
    truncationReason: tagSetComplete ? null : 'max-tags',
  }
  const projection = {
    source: {
      id: 'github-public-repository-tags',
      endpointTemplate: `${API_BASE_URL}/repos/{owner}/{repository}/tags`,
      apiVersion: API_VERSION,
    },
    request: normalizedInput,
    repositoryUrl: `https://github.com/${normalizedInput.owner}/${normalizedInput.repository}`,
    coverage,
    tags: sortedTags,
    tagSetDigest,
  }
  const assertions = [
    { id: 'response-shape', passed: true },
    { id: 'api-version', passed: pages.every((entry) => entry.selectedApiVersion === API_VERSION) },
    { id: 'core-rate-bucket', passed: pages.every((entry) => entry.rateLimit.resource === 'core') },
    { id: 'bounded-requests', passed: pages.length <= Math.ceil(normalizedInput.maxTags / PAGE_SIZE) },
    { id: 'unique-tag-names', passed: new Set(sortedTags.map((tag) => tag.name)).size === sortedTags.length },
    { id: 'commit-identities', passed: sortedTags.every((tag) => SHA_PATTERN.test(tag.commitSha)) },
    { id: 'coverage-declared', passed: coverage.tagSetComplete !== coverage.truncated },
  ]
  return {
    ...projection,
    rateLimit: pages.at(-1)?.rateLimit ?? { resource: null, limit: null, remaining: null, resetAt: null },
    observedAt: now().toISOString(),
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

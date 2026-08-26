import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.github.com'
export const API_VERSION = '2026-03-10'
export const SEARCH_ENDPOINT = '/search/repositories'
export const RESULT_WINDOW_LIMIT = 1000

const ALLOWED_INPUT_KEYS = new Set(['query', 'sort', 'order', 'page', 'perPage'])
const SORT_VALUES = new Set(['best-match', 'stars', 'forks', 'help-wanted-issues', 'updated'])
const ORDER_VALUES = new Set(['desc', 'asc'])

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.query !== 'string' || input.query.trim().length < 1 || input.query.trim().length > 256 || /[\r\n]/.test(input.query)) throw new Error('query must be a single-line string between 1 and 256 characters')
  const sort = input.sort ?? 'best-match'
  const order = input.order ?? 'desc'
  const page = input.page ?? 1
  const perPage = input.perPage ?? 10
  if (!SORT_VALUES.has(sort)) throw new Error(`unsupported sort: ${sort}`)
  if (!ORDER_VALUES.has(order)) throw new Error(`unsupported order: ${order}`)
  if (!Number.isInteger(page) || page < 1 || page > 10) throw new Error('page must be an integer between 1 and 10')
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 25) throw new Error('perPage must be an integer between 1 and 25')
  return { query: input.query.trim(), sort, order, page, perPage }
}

function parseIntegerHeader(headers, name) {
  const value = headers.get(name)
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value)
}

function normalizeRepository(item) {
  return {
    id: item.id,
    fullName: item.full_name,
    url: item.html_url,
    description: item.description ?? null,
    defaultBranch: item.default_branch,
    fork: item.fork,
    archived: item.archived,
    disabled: item.disabled,
    visibility: item.visibility,
    licenseSpdx: item.license?.spdx_id ?? null,
    topics: Array.isArray(item.topics) ? [...new Set(item.topics)].sort() : [],
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
  }
}

function assertPublicRepositoryPayload(payload) {
  if (!payload || !Number.isInteger(payload.total_count) || payload.total_count < 0 || typeof payload.incomplete_results !== 'boolean' || !Array.isArray(payload.items)) {
    throw new Error('GitHub repository search response shape changed')
  }
  for (const item of payload.items) {
    const valid = Number.isInteger(item?.id)
      && typeof item.full_name === 'string'
      && /^https:\/\/github\.com\//.test(item.html_url)
      && typeof item.default_branch === 'string'
      && typeof item.fork === 'boolean'
      && typeof item.archived === 'boolean'
      && typeof item.disabled === 'boolean'
      && typeof item.updated_at === 'string'
      && (typeof item.pushed_at === 'string' || item.pushed_at === null)
    if (!valid) throw new Error('GitHub repository search item shape changed')
    if (item.visibility !== 'public') throw new Error('GitHub repository search returned a non-public repository')
  }
}

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function normalizeRepositorySearchResponse(payload, { input, headers = new Headers(), observedAt = new Date().toISOString() }) {
  const normalizedInput = assertInput(input)
  assertPublicRepositoryPayload(payload)
  const repositories = payload.items.map(normalizeRepository)
  const totalCount = payload?.total_count
  const incompleteResults = payload?.incomplete_results
  const selectedVersion = headers.get('x-github-api-version-selected')
  const rateLimitReset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  const assertions = [
    { id: 'response-shape', passed: true },
    { id: 'api-version', passed: selectedVersion === API_VERSION },
    { id: 'search-rate-bucket', passed: headers.get('x-ratelimit-resource') === 'search' },
    { id: 'page-bound', passed: repositories.length <= normalizedInput.perPage },
    { id: 'public-repositories-only', passed: repositories.every((repository) => repository.visibility === 'public' && repository.url.startsWith('https://github.com/')) },
    { id: 'complete-response', passed: incompleteResults === false },
  ]
  const projection = {
    source: { id: 'github-public-repository-search', endpoint: `${API_BASE_URL}${SEARCH_ENDPOINT}`, apiVersion: API_VERSION },
    query: normalizedInput,
    coverage: {
      representation: 'ranked-page',
      totalCount,
      returnedCount: repositories.length,
      incompleteResults,
      accessibleResultCount: Number.isInteger(totalCount) ? Math.min(totalCount, RESULT_WINDOW_LIMIT) : null,
      resultWindowLimit: RESULT_WINDOW_LIMIT,
      pageExhausted: Number.isInteger(totalCount) && (repositories.length < normalizedInput.perPage || normalizedInput.page * normalizedInput.perPage >= Math.min(totalCount, RESULT_WINDOW_LIMIT)),
      ecosystemComplete: false,
    },
    repositories,
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
    resultDigest: digest(projection),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function searchPublicRepositories(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  const url = new URL(SEARCH_ENDPOINT, API_BASE_URL)
  url.searchParams.set('q', normalizedInput.query)
  url.searchParams.set('page', String(normalizedInput.page))
  url.searchParams.set('per_page', String(normalizedInput.perPage))
  if (normalizedInput.sort !== 'best-match') {
    url.searchParams.set('sort', normalizedInput.sort)
    url.searchParams.set('order', normalizedInput.order)
  }
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
    throw new Error(`GitHub repository search failed: HTTP_${response.status}; rateLimitRemaining=${remaining ?? 'unknown'}; rateLimitReset=${reset ?? 'unknown'}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`GitHub repository search returned ${contentType || 'no content type'}`)
  return normalizeRepositorySearchResponse(await response.json(), { input: normalizedInput, headers: response.headers, observedAt: now().toISOString() })
}

import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.github.com'
export const API_VERSION = '2026-03-10'
export const PAGE_SIZE = 100
export const MAX_ITEMS = 500
export const MAX_REQUESTS = 5
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

const ALLOWED_INPUT_KEYS = new Set(['owner', 'repository', 'checkpoint', 'maxItems'])
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SECOND_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/

const digest = (value) => createHash('sha256').update(value).digest('hex')

export class GitHubPublicRepositoryWorkItemChangesError extends Error {
  constructor(message, { code, httpStatus, retryAt = null } = {}) {
    super(message)
    this.name = 'GitHubPublicRepositoryWorkItemChangesError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

function canonicalSecondTimestamp(value, field) {
  if (typeof value !== 'string' || !SECOND_TIMESTAMP_PATTERN.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${field} must be a canonical whole-second UTC timestamp`)
  }
  if (Date.parse(value) < Date.parse('2008-01-01T00:00:00.000Z')) throw new Error(`${field} predates the public GitHub era`)
  return value
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.owner !== 'string' || !OWNER_PATTERN.test(input.owner)) throw new Error('owner must be a bounded GitHub owner name')
  if (typeof input.repository !== 'string' || !REPOSITORY_PATTERN.test(input.repository) || ['.', '..'].includes(input.repository) || input.repository.toLowerCase().endsWith('.git')) {
    throw new Error('repository must be a bounded GitHub repository name without .git')
  }
  if (!input.checkpoint || typeof input.checkpoint !== 'object' || Array.isArray(input.checkpoint)) throw new Error('checkpoint must be an object')
  const checkpointUnknown = Object.keys(input.checkpoint).filter((key) => !['updatedAt', 'seenItemDigests'].includes(key))
  if (checkpointUnknown.length > 0) throw new Error(`unknown checkpoint fields: ${checkpointUnknown.join(', ')}`)
  const updatedAt = canonicalSecondTimestamp(input.checkpoint.updatedAt, 'checkpoint.updatedAt')
  if (!Array.isArray(input.checkpoint.seenItemDigests) || input.checkpoint.seenItemDigests.length > MAX_ITEMS) throw new Error(`checkpoint.seenItemDigests must contain at most ${MAX_ITEMS} entries`)
  const seenItemDigests = input.checkpoint.seenItemDigests.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => !['number', 'digest'].includes(key))) throw new Error('checkpoint entry shape is invalid')
    if (!Number.isSafeInteger(entry.number) || entry.number < 1) throw new Error('checkpoint entry number must be a positive safe integer')
    if (typeof entry.digest !== 'string' || !SHA256_PATTERN.test(entry.digest)) throw new Error('checkpoint entry digest must be SHA-256')
    return { number: entry.number, digest: entry.digest }
  })
  if (new Set(seenItemDigests.map((entry) => entry.number)).size !== seenItemDigests.length) throw new Error('checkpoint entry numbers must be unique')
  seenItemDigests.sort((left, right) => left.number - right.number)
  const maxItems = input.maxItems ?? 100
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS) throw new Error(`maxItems must be an integer between 1 and ${MAX_ITEMS}`)
  return { owner: input.owner, repository: input.repository, checkpoint: { updatedAt, seenItemDigests }, maxItems }
}

function parseIntegerHeader(headers, name) {
  const value = headers.get(name)
  return value !== null && /^\d+$/.test(value) ? Number(value) : null
}

function retryAt(headers, observedAt) {
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

function boundedText(value, field, maximum, { nullable = false } = {}) {
  if (value === null && nullable) return null
  if (typeof value !== 'string') throw new Error(`GitHub work item ${field} is invalid`)
  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (!normalized || [...normalized].length > maximum || /[\u0000-\u001f\u007f]/u.test(normalized)) throw new Error(`GitHub work item ${field} is missing or exceeds its bound`)
  return normalized
}

function dateTime(value, field, { nullable = false } = {}) {
  if (value === null && nullable) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`GitHub work item ${field} is invalid`)
  return new Date(value).toISOString()
}

function assertRepositoryUrl(value, input, number, kind, { api = false } = {}) {
  let url
  try { url = new URL(value) } catch { throw new Error('GitHub work item URL is invalid') }
  const expected = api
    ? `/repos/${input.owner}/${input.repository}/issues/${number}`
    : `/${input.owner}/${input.repository}/${kind === 'pull-request' ? 'pull' : 'issues'}/${number}`
  const expectedHost = api ? 'api.github.com' : 'github.com'
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password || url.port || url.search || url.hash || url.pathname.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('GitHub work item URL escaped the requested public repository')
  }
  return url.href
}

function normalizeLabels(labels) {
  if (!Array.isArray(labels) || labels.length > 64) throw new Error('GitHub work item labels exceed the bound')
  const normalized = labels.map((label) => boundedText(typeof label === 'string' ? label : label?.name, 'label', 100))
  if (new Set(normalized).size !== normalized.length) throw new Error('GitHub work item labels contain duplicates')
  return normalized.sort((left, right) => left.localeCompare(right))
}

function normalizeWorkItem(item, input) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || !Number.isSafeInteger(item.id) || item.id < 1 || !Number.isSafeInteger(item.number) || item.number < 1) {
    throw new Error('GitHub work item response shape changed')
  }
  const kind = item.pull_request && typeof item.pull_request === 'object' ? 'pull-request' : 'issue'
  const state = item.state
  if (!['open', 'closed'].includes(state) || typeof item.locked !== 'boolean' || !Number.isSafeInteger(item.comments) || item.comments < 0) throw new Error('GitHub work item state shape changed')
  const createdAt = dateTime(item.created_at, 'created_at')
  const updatedAt = dateTime(item.updated_at, 'updated_at')
  const closedAt = dateTime(item.closed_at, 'closed_at', { nullable: true })
  if (Date.parse(updatedAt) < Date.parse(createdAt) || (closedAt && Date.parse(closedAt) < Date.parse(createdAt))) throw new Error('GitHub work item lifecycle timestamps are inconsistent')
  const body = item.body === null ? '' : typeof item.body === 'string' ? item.body : null
  if (body === null) throw new Error('GitHub work item body shape changed')
  const projection = {
    number: item.number,
    kind,
    url: assertRepositoryUrl(item.html_url, input, item.number, kind),
    state,
    stateReason: item.state_reason === null ? null : boundedText(item.state_reason, 'state reason', 64),
    title: boundedText(item.title, 'title', 512),
    labels: normalizeLabels(item.labels),
    comments: item.comments,
    locked: item.locked,
    createdAt,
    updatedAt,
    closedAt,
    body: { present: item.body !== null, length: [...body].length, sha256: digest(body) },
  }
  assertRepositoryUrl(item.url, input, item.number, kind, { api: true })
  if (typeof item.repository_url !== 'string' || item.repository_url.toLowerCase() !== `${API_BASE_URL}/repos/${input.owner}/${input.repository}`.toLowerCase()) throw new Error('GitHub work item repository identity changed')
  return { ...projection, changeDigest: digest(JSON.stringify(projection)) }
}

function compareItems(left, right) {
  return left.updatedAt.localeCompare(right.updatedAt) || left.number - right.number
}

export function normalizeRepositoryWorkItemPage(payload, { input, page, headers = new Headers() }) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(page) || page < 1 || page > MAX_REQUESTS) throw new Error('page is outside the bounded request')
  if (!Array.isArray(payload) || payload.length > PAGE_SIZE) throw new Error('GitHub work item page shape changed')
  const items = payload.map((item) => normalizeWorkItem(item, normalizedInput))
  if (new Set(items.map((item) => item.number)).size !== items.length) throw new Error('GitHub work item page contains duplicate numbers')
  const ordered = items.every((item, index) => index === 0 || compareItems(items[index - 1], item) <= 0)
  const reset = parseIntegerHeader(headers, 'x-ratelimit-reset')
  return {
    items,
    ordered,
    pageHasNext: hasNextPage(headers.get('link')),
    selectedApiVersion: headers.get('x-github-api-version-selected'),
    rateLimit: {
      resource: headers.get('x-ratelimit-resource'),
      limit: parseIntegerHeader(headers, 'x-ratelimit-limit'),
      remaining: parseIntegerHeader(headers, 'x-ratelimit-remaining'),
      resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
    },
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`GitHub work item page returned ${contentType || 'no content type'}`)
  const declared = response.headers.get('content-length')
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_RESPONSE_BYTES) throw new Error('GitHub work item page exceeds the 2 MiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GitHub work item page has no response body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let receivedBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('GitHub work item page exceeds the 2 MiB budget') }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error.message.includes('2 MiB budget')) throw error
    throw new Error('GitHub work item page is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new Error('GitHub work item page is not valid JSON') }
}

function apiSince(checkpoint) {
  return new Date(Date.parse(checkpoint.updatedAt) - 1000).toISOString().replace('.000Z', 'Z')
}

function unseenAtCheckpoint(item, checkpoint, seen) {
  if (item.updatedAt > checkpoint.updatedAt) return true
  if (item.updatedAt < checkpoint.updatedAt) return false
  return seen.get(item.number) !== item.changeDigest
}

function nextCheckpoint(inputCheckpoint, returnedItems) {
  if (returnedItems.length === 0) return inputCheckpoint
  const updatedAt = returnedItems.at(-1).updatedAt
  const seen = new Map(updatedAt === inputCheckpoint.updatedAt ? inputCheckpoint.seenItemDigests.map((entry) => [entry.number, entry.digest]) : [])
  for (const item of returnedItems) if (item.updatedAt === updatedAt) seen.set(item.number, item.changeDigest)
  const seenItemDigests = [...seen].sort(([left], [right]) => left - right).map(([number, entryDigest]) => ({ number, digest: entryDigest }))
  if (seenItemDigests.length > MAX_ITEMS) throw new Error('GitHub work item checkpoint exceeds the same-second identity budget')
  return { updatedAt, seenItemDigests }
}

export async function listPublicRepositoryWorkItemChanges(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  if (typeof userAgent !== 'string' || userAgent.length < 1 || userAgent.length > 128 || /[\r\n]/.test(userAgent)) throw new Error('userAgent must be a bounded single-line string')
  const pages = []
  const scanned = []
  const eligible = []
  const seenNumbers = new Set()
  const checkpointSeen = new Map(normalizedInput.checkpoint.seenItemDigests.map((entry) => [entry.number, entry.digest]))
  let page = 1
  let pageHasNext = true
  let overflow = false
  while (page <= MAX_REQUESTS && pageHasNext && !overflow) {
    const url = new URL(`/repos/${encodeURIComponent(normalizedInput.owner)}/${encodeURIComponent(normalizedInput.repository)}/issues`, API_BASE_URL)
    url.searchParams.set('state', 'all')
    url.searchParams.set('sort', 'updated')
    url.searchParams.set('direction', 'asc')
    url.searchParams.set('since', apiSince(normalizedInput.checkpoint))
    url.searchParams.set('per_page', String(PAGE_SIZE))
    url.searchParams.set('page', String(page))
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': API_VERSION, 'user-agent': userAgent },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const rateLimited = [403, 429].includes(response.status) && response.headers.get('x-ratelimit-remaining') === '0'
      const code = response.status === 404 ? 'repository-not-found' : rateLimited ? 'rate-limited' : `http-${response.status}`
      throw new GitHubPublicRepositoryWorkItemChangesError(`GitHub work item read failed: HTTP_${response.status}`, { code, httpStatus: response.status, retryAt: retryAt(response.headers, now()) })
    }
    const normalizedPage = normalizeRepositoryWorkItemPage(await readJsonResponse(response), { input: normalizedInput, page, headers: response.headers })
    pages.push(normalizedPage)
    for (const item of normalizedPage.items) {
      if (seenNumbers.has(item.number)) throw new Error('GitHub work item pagination returned duplicate numbers')
      seenNumbers.add(item.number)
      scanned.push(item)
      if (unseenAtCheckpoint(item, normalizedInput.checkpoint, checkpointSeen)) {
        if (eligible.length < normalizedInput.maxItems) eligible.push(item)
        else overflow = true
      }
    }
    pageHasNext = normalizedPage.pageHasNext
    page += 1
  }
  eligible.sort(compareItems)
  const complete = !overflow && !pageHasNext
  const coverage = {
    representation: 'incremental-work-item-window',
    delivery: 'bounded-composite-checkpoint',
    scannedCount: scanned.length,
    returnedCount: eligible.length,
    requestsMade: pages.length,
    perRequestLimit: PAGE_SIZE,
    maximumItems: normalizedInput.maxItems,
    maximumRequests: MAX_REQUESTS,
    pageExhausted: !pageHasNext,
    complete,
    truncated: !complete,
    truncationReason: complete ? null : overflow ? 'max-items' : 'max-requests',
    sameSecondReplayProtected: true,
  }
  const projection = {
    source: { id: 'github-public-repository-work-item-changes', endpointTemplate: `${API_BASE_URL}/repos/{owner}/{repository}/issues`, apiVersion: API_VERSION },
    request: normalizedInput,
    repositoryUrl: `https://github.com/${normalizedInput.owner}/${normalizedInput.repository}`,
    coverage,
    items: eligible,
    nextCheckpoint: nextCheckpoint(normalizedInput.checkpoint, eligible),
    windowDigest: digest(JSON.stringify(eligible)),
  }
  const assertions = [
    { id: 'response-shape', passed: true },
    { id: 'api-version', passed: pages.every((entry) => entry.selectedApiVersion === API_VERSION) },
    { id: 'core-rate-bucket', passed: pages.every((entry) => entry.rateLimit.resource === 'core') },
    { id: 'ascending-update-order', passed: pages.every((entry) => entry.ordered) },
    { id: 'bounded-requests', passed: pages.length <= MAX_REQUESTS },
    { id: 'unique-work-item-numbers', passed: new Set(scanned.map((item) => item.number)).size === scanned.length },
    { id: 'checkpoint-declared', passed: projection.nextCheckpoint.updatedAt >= normalizedInput.checkpoint.updatedAt },
    { id: 'coverage-declared', passed: coverage.complete !== coverage.truncated },
    { id: 'personal-fields-excluded', passed: !/("user"|"assignee"|"author"|"email"|"avatar")\s*:/i.test(JSON.stringify(projection)) },
  ]
  return {
    ...projection,
    rateLimit: pages.at(-1)?.rateLimit ?? { resource: null, limit: null, remaining: null, resetAt: null },
    observedAt: now().toISOString(),
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

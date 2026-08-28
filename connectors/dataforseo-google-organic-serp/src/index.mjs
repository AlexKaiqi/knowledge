import { createHash } from 'node:crypto'

export const ENDPOINTS = Object.freeze({
  sandbox: 'https://sandbox.dataforseo.com/v3/serp/google/organic/live/advanced',
  production: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
})

const ALLOWED_INPUT_KEYS = new Set(['query', 'locationCode', 'languageCode', 'device', 'limit'])
const DEVICES = new Set(['desktop', 'mobile'])
const EXPENSIVE_OPERATOR = /\b(?:allinanchor|allintext|allintitle|allinurl|cache|define|definition|filetype|id|inanchor|info|intext|intitle|inurl|link|site)\s*:/i

export class GoogleOrganicSerpError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'GoogleOrganicSerpError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function requireBoundedString(value, field, maximum) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum || /[\r\n\0]/.test(value)) {
    throw new GoogleOrganicSerpError('invalid-input', `${field} must be a non-empty single-line string up to ${maximum} characters`)
  }
  return value.trim()
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new GoogleOrganicSerpError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new GoogleOrganicSerpError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  const query = requireBoundedString(input.query, 'query', 500)
  if (EXPENSIVE_OPERATOR.test(query)) throw new GoogleOrganicSerpError('financial-policy', 'advanced search operators are not supported by the bounded single-page contract')
  const locationCode = input.locationCode
  if (!Number.isInteger(locationCode) || locationCode < 1 || locationCode > 2147483647) throw new GoogleOrganicSerpError('invalid-input', 'locationCode must be a positive 32-bit integer')
  const languageCode = requireBoundedString(input.languageCode, 'languageCode', 16)
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(languageCode)) throw new GoogleOrganicSerpError('invalid-input', 'languageCode is invalid')
  const device = input.device ?? 'desktop'
  if (!DEVICES.has(device)) throw new GoogleOrganicSerpError('invalid-input', `unsupported device: ${device}`)
  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new GoogleOrganicSerpError('financial-policy', 'limit must be an integer between 1 and 10')
  return { query, locationCode, languageCode, device, limit }
}

function normalizeCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) throw new GoogleOrganicSerpError('credential-unavailable', 'provider API credentials are required')
  const login = credentials.login
  const password = credentials.password
  if (typeof login !== 'string' || login.length < 1 || login.length > 512 || /[:\r\n\0]/.test(login)) throw new GoogleOrganicSerpError('credential-unavailable', 'provider API login is invalid')
  if (typeof password !== 'string' || password.length < 1 || password.length > 1024 || /[\r\n\0]/.test(password)) throw new GoogleOrganicSerpError('credential-unavailable', 'provider API password is invalid')
  return { login, password }
}

function parseObservedAt(value) {
  if (typeof value !== 'string') throw new GoogleOrganicSerpError('response-shape-changed', 'result datetime is missing')
  const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/, '$1T$2$3')
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp)) throw new GoogleOrganicSerpError('response-shape-changed', 'result datetime is invalid')
  return new Date(timestamp).toISOString()
}

function safeHttpUrl(value, field) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) throw new GoogleOrganicSerpError('response-shape-changed', `${field} is invalid`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new GoogleOrganicSerpError('response-shape-changed', `${field} is not a URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new GoogleOrganicSerpError('response-shape-changed', `${field} is unsafe`)
  return url
}

function boundedNullableString(value, field, maximum) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maximum) throw new GoogleOrganicSerpError('response-shape-changed', `${field} is invalid`)
  return value
}

function normalizeOrganicItem(item) {
  const ranksValid = item && item.type === 'organic' && Number.isInteger(item.rank_group) && item.rank_group > 0
    && Number.isInteger(item.rank_absolute) && item.rank_absolute > 0 && item.page === 1
  if (!ranksValid) throw new GoogleOrganicSerpError('response-shape-changed', 'organic result rank shape changed')
  const title = boundedNullableString(item.title, 'organic title', 2000)
  const domain = boundedNullableString(item.domain, 'organic domain', 512)
  if (!title || !domain || !/^[A-Za-z0-9.-]+$/.test(domain)) throw new GoogleOrganicSerpError('response-shape-changed', 'organic result identity is invalid')
  const url = safeHttpUrl(item.url, 'organic URL')
  const host = url.hostname.toLowerCase()
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '')
  if (host !== normalizedDomain && host !== `www.${normalizedDomain}` && !host.endsWith(`.${normalizedDomain}`)) {
    throw new GoogleOrganicSerpError('response-shape-changed', 'organic domain does not match URL')
  }
  return {
    rank: item.rank_group,
    absoluteRank: item.rank_absolute,
    title,
    url: url.href,
    domain: normalizedDomain,
    snippet: boundedNullableString(item.description, 'organic description', 8000),
  }
}

function validateResponseEnvelope(payload, query, environment) {
  const validRoot = payload && payload.status_code === 20000 && payload.tasks_count === 1 && payload.tasks_error === 0
    && Array.isArray(payload.tasks) && payload.tasks.length === 1 && Number.isFinite(payload.cost) && payload.cost >= 0
  if (!validRoot) throw new GoogleOrganicSerpError('provider-error', 'search provider rejected the request or changed its response envelope')
  const task = payload.tasks[0]
  const validTask = task && task.status_code === 20000 && task.result_count === 1 && Array.isArray(task.result) && task.result.length === 1
    && Number.isFinite(task.cost) && task.cost >= 0
  if (!validTask) throw new GoogleOrganicSerpError('provider-error', 'search provider task failed or changed shape')
  const result = task.result[0]
  if (!result || !Array.isArray(result.items) || typeof result.se_domain !== 'string' || result.se_domain.length < 1 || result.se_domain.length > 512) {
    throw new GoogleOrganicSerpError('response-shape-changed', 'search result shape changed')
  }
  if (environment === 'production') {
    const taskData = task.data
    const inputMatched = taskData && taskData.keyword === query.query && taskData.location_code === query.locationCode
      && taskData.language_code === query.languageCode && taskData.device === query.device
    const resultMatched = result.keyword === query.query && result.location_code === query.locationCode && result.language_code === query.languageCode
    if (!inputMatched || !resultMatched) throw new GoogleOrganicSerpError('response-identity-drift', 'search response does not match the requested query contract')
  }
  return { task, result }
}

export function normalizeSerpResponse(payload, {
  input,
  environment = 'production',
  maxCostUsd = 0.01,
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  if (!Object.hasOwn(ENDPOINTS, environment)) throw new GoogleOrganicSerpError('configuration-error', `unsupported environment: ${environment}`)
  if (typeof maxCostUsd !== 'number' || !Number.isFinite(maxCostUsd) || maxCostUsd < 0 || maxCostUsd > 0.05) throw new GoogleOrganicSerpError('configuration-error', 'maxCostUsd is invalid')
  const { task, result } = validateResponseEnvelope(payload, query, environment)
  if (environment === 'production' && task.cost > maxCostUsd) throw new GoogleOrganicSerpError('cost-bound-exceeded', 'reported search cost exceeds the configured bound', { chargedCostUsd: task.cost, maxCostUsd })
  const organic = result.items.filter((item) => item?.type === 'organic').map(normalizeOrganicItem).sort((left, right) => left.rank - right.rank)
  if (new Set(organic.map((item) => item.rank)).size !== organic.length) throw new GoogleOrganicSerpError('response-shape-changed', 'organic ranks are not unique')
  const results = organic.slice(0, query.limit)
  const verificationUrl = safeHttpUrl(result.check_url, 'search verification URL')
  const observedAt = parseObservedAt(result.datetime)
  const projection = {
    source: {
      engine: 'google-organic',
      engineDomain: result.se_domain.toLowerCase(),
      verificationUrl: verificationUrl.href,
    },
    query,
    coverage: {
      representation: 'single-observed-serp-page',
      requestedOrganicLimit: query.limit,
      returnedOrganicCount: results.length,
      availableOrganicCount: organic.length,
      page: 1,
      complete: false,
      resultCountEstimateRetained: false,
    },
    billing: {
      currency: 'USD',
      chargedCost: environment === 'production' ? task.cost : 0,
      costBound: maxCostUsd,
    },
    results,
    observedAt,
    collectedAt: now().toISOString(),
  }
  const assertions = [
    { id: 'single-page-bound', passed: results.length <= query.limit && query.limit <= 10 },
    { id: 'organic-only', passed: results.every((item) => item.rank > 0 && item.url.startsWith('http')) },
    { id: 'rank-unique', passed: new Set(results.map((item) => item.rank)).size === results.length },
    { id: 'corpus-incomplete', passed: projection.coverage.complete === false },
    { id: 'result-count-estimate-removed', passed: projection.coverage.resultCountEstimateRetained === false },
    { id: 'cost-bounded', passed: projection.billing.chargedCost <= maxCostUsd },
  ]
  return {
    ...projection,
    resultDigest: sha256(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

async function readJsonWithLimit(response, maxResponseBytes) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new GoogleOrganicSerpError('response-too-large', `search response exceeds ${maxResponseBytes} bytes`)
  if (!response.body) throw new GoogleOrganicSerpError('response-shape-changed', 'search response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxResponseBytes) {
      await reader.cancel()
      throw new GoogleOrganicSerpError('response-too-large', `search response exceeds ${maxResponseBytes} bytes`)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    throw new GoogleOrganicSerpError('response-shape-changed', 'search response is not valid JSON')
  }
}

export async function readGoogleOrganicResultPage(input, {
  fetchImpl = fetch,
  credentials,
  environment = 'sandbox',
  timeoutMs = 15_000,
  maxResponseBytes = 2_097_152,
  maxCostUsd = 0.01,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  const auth = normalizeCredentials(credentials)
  if (!Object.hasOwn(ENDPOINTS, environment)) throw new GoogleOrganicSerpError('configuration-error', `unsupported environment: ${environment}`)
  const body = [{
    keyword: query.query,
    location_code: query.locationCode,
    language_code: query.languageCode,
    device: query.device,
    os: query.device === 'mobile' ? 'android' : 'windows',
    depth: query.limit,
  }]
  const authorization = `Basic ${Buffer.from(`${auth.login}:${auth.password}`, 'utf8').toString('base64')}`
  const response = await fetchImpl(ENDPOINTS[environment], {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization,
      'content-type': 'application/json; charset=utf-8',
      'user-agent': userAgent,
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 401 ? 'authentication-failed' : response.status === 429 ? 'rate-limited' : 'http-error'
    throw new GoogleOrganicSerpError(code, `search request failed: HTTP_${response.status}`, { status: response.status })
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new GoogleOrganicSerpError('response-shape-changed', `search response returned ${contentType || 'no content type'}`)
  const payload = await readJsonWithLimit(response, maxResponseBytes)
  return normalizeSerpResponse(payload, { input: query, environment, maxCostUsd, now })
}

import { createHash } from 'node:crypto'

export const ENDPOINTS = Object.freeze({
  productionPost: 'https://api.dataforseo.com/v3/business_data/google/reviews/task_post',
  productionGetBase: 'https://api.dataforseo.com/v3/business_data/google/reviews/task_get/',
  sandboxGet: 'https://sandbox.dataforseo.com/v3/business_data/google/reviews/task_get/00000000-0000-0000-0000-000000000000',
})
export const MAX_REVIEWS = 20
export const MAXIMUM_COST_USD = 0.002
export const TASK_RESULT_DEADLINE_SECONDS = 2700

const ALLOWED_INPUT_KEYS = new Set(['query', 'locationCode', 'languageCode', 'limit', 'sort', 'usageMode', 'acknowledgeNoIdentityGraph', 'acknowledgeTransientVerbatimOnly', 'acknowledgeTargetTermsReview'])
const ROOT_KEYS = new Set(['version', 'status_code', 'status_message', 'time', 'cost', 'tasks_count', 'tasks_error', 'tasks'])
const TASK_KEYS = new Set(['id', 'status_code', 'status_message', 'time', 'cost', 'result_count', 'path', 'data', 'result'])
const RESULT_KEYS = new Set(['keyword', 'type', 'se_domain', 'location_code', 'language_code', 'check_url', 'datetime', 'title', 'sub_title', 'rating', 'feature_id', 'place_id', 'cid', 'reviews_count', 'items_count', 'items'])
const REVIEW_KEYS = new Set(['type', 'rank_group', 'rank_absolute', 'position', 'xpath', 'review_text', 'original_review_text', 'original_language', 'time_ago', 'timestamp', 'rating', 'reviews_count', 'photos_count', 'local_guide', 'profile_name', 'profile_url', 'review_url', 'profile_image_url', 'owner_answer', 'original_owner_answer', 'owner_time_ago', 'owner_timestamp', 'review_id', 'images', 'review_highlights'])
const RATING_KEYS = new Set(['rating_type', 'value', 'votes_count', 'rating_max'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXPENSIVE_OPERATOR = /\b(?:allinanchor|allintext|allintitle|allinurl|cache|define|filetype|id|inanchor|info|intext|intitle|inurl|link|related|site)\s*:/i

export class DataForSeoPublicReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'DataForSeoPublicReviewError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function onlyKeys(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} must be an object`)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} returned unexpected fields: ${unknown.join(', ')}`)
}

function singleLine(value, field, maximum) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum || /[\r\n\0]/.test(value)) throw new DataForSeoPublicReviewError('invalid-input', `${field} must be a non-empty single-line string up to ${maximum} characters`)
  return value.trim()
}

function nullableText(value, field, maximum) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0')) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is invalid`)
  return value
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DataForSeoPublicReviewError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new DataForSeoPublicReviewError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  const query = singleLine(input.query, 'query', 200)
  if (EXPENSIVE_OPERATOR.test(query)) throw new DataForSeoPublicReviewError('financial-policy', 'advanced search operators are not supported for establishment resolution')
  if (!Number.isInteger(input.locationCode) || input.locationCode < 1 || input.locationCode > 2147483647) throw new DataForSeoPublicReviewError('invalid-input', 'locationCode must be a positive 32-bit integer')
  const languageCode = singleLine(input.languageCode, 'languageCode', 16)
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(languageCode)) throw new DataForSeoPublicReviewError('invalid-input', 'languageCode is invalid')
  if ((input.limit ?? MAX_REVIEWS) !== MAX_REVIEWS) throw new DataForSeoPublicReviewError('financial-policy', `limit must be exactly ${MAX_REVIEWS} for the reviewed two-unit task`)
  if ((input.sort ?? 'newest') !== 'newest') throw new DataForSeoPublicReviewError('invalid-input', 'only newest-first research snapshots are supported')
  if (input.usageMode !== 'bounded-public-demand-research') throw new DataForSeoPublicReviewError('policy-not-acknowledged', 'usageMode must be bounded-public-demand-research')
  if (input.acknowledgeNoIdentityGraph !== true) throw new DataForSeoPublicReviewError('policy-not-acknowledged', 'reviewer identity graph prohibition must be acknowledged')
  if (input.acknowledgeTransientVerbatimOnly !== true) throw new DataForSeoPublicReviewError('policy-not-acknowledged', 'transient-only verbatim retention must be acknowledged')
  if (input.acknowledgeTargetTermsReview !== true) throw new DataForSeoPublicReviewError('policy-not-acknowledged', 'target-platform terms and rights review must be acknowledged')
  return {
    query,
    locationCode: input.locationCode,
    languageCode,
    limit: MAX_REVIEWS,
    sort: 'newest',
    usageMode: input.usageMode,
    acknowledgeNoIdentityGraph: true,
    acknowledgeTransientVerbatimOnly: true,
    acknowledgeTargetTermsReview: true,
  }
}

function normalizeCredentials(credentials) {
  const login = credentials?.login
  const password = credentials?.password
  if (typeof login !== 'string' || login.length < 1 || login.length > 512 || /[:\r\n\0]/.test(login)) throw new DataForSeoPublicReviewError('credential-unavailable', 'DataForSEO API login is unavailable or invalid')
  if (typeof password !== 'string' || password.length < 1 || password.length > 1024 || /[\r\n\0]/.test(password)) throw new DataForSeoPublicReviewError('credential-unavailable', 'DataForSEO API password is unavailable or invalid')
  return { login, password }
}

function normalizeCost(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is invalid`)
  return value
}

function validateRoot(payload) {
  onlyKeys(payload, ROOT_KEYS, 'provider response')
  if (payload.status_code !== 20000 || payload.tasks_count !== 1 || !Array.isArray(payload.tasks) || payload.tasks.length !== 1) throw new DataForSeoPublicReviewError('provider-error', 'provider response did not contain exactly one successful task envelope')
  normalizeCost(payload.cost, 'provider response cost')
  return payload.tasks[0]
}

function validateTaskIdentity(task, taskId) {
  onlyKeys(task, TASK_KEYS, 'provider task')
  if (!UUID_PATTERN.test(task.id) || (taskId && task.id !== taskId)) throw new DataForSeoPublicReviewError('response-identity-drift', 'provider task identity changed')
  normalizeCost(task.cost, 'provider task cost')
}

function inputEchoMatches(data, input) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && data.keyword === input.query
    && data.location_code === input.locationCode
    && data.language_code === input.languageCode
    && data.depth === MAX_REVIEWS
    && data.sort_by === 'newest'
    && data.priority === 1
    && data.postback_url === undefined
    && data.pingback_url === undefined
}

function authHeader(credentials) {
  const { login, password } = normalizeCredentials(credentials)
  return `Basic ${Buffer.from(`${login}:${password}`, 'utf8').toString('base64')}`
}

async function readJsonWithLimit(response, maxResponseBytes, stage) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new DataForSeoPublicReviewError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
  if (!response.body) throw new DataForSeoPublicReviewError('response-shape-changed', `${stage} response has no body`)
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxResponseBytes) {
      await reader.cancel()
      throw new DataForSeoPublicReviewError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
    }
    chunks.push(value)
  }
  try { return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) } catch { throw new DataForSeoPublicReviewError('response-shape-changed', `${stage} response is not valid JSON`) }
}

async function fetchJson(url, { fetchImpl, method = 'GET', body, credentials, timeoutMs, maxResponseBytes, userAgent, stage }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      accept: 'application/json',
      authorization: authHeader(credentials),
      ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}),
      'user-agent': userAgent,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 401 ? 'authentication-failed' : response.status === 402 ? 'billing-unavailable' : response.status === 429 ? 'rate-limited' : 'http-error'
    throw new DataForSeoPublicReviewError(code, `${stage} request failed: HTTP_${response.status}`, { status: response.status })
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new DataForSeoPublicReviewError('response-shape-changed', `${stage} response returned ${contentType || 'no content type'}`)
  return readJsonWithLimit(response, maxResponseBytes, stage)
}

export function normalizeTaskSubmission(payload, { input, maxCostUsd = MAXIMUM_COST_USD, now = () => new Date() } = {}) {
  const query = normalizeInput(input)
  const task = validateRoot(payload)
  validateTaskIdentity(task)
  if (payload.tasks_error !== 0 || task.status_code !== 20100 || task.result_count !== 0 || (task.result !== null && task.result !== undefined)) throw new DataForSeoPublicReviewError('provider-error', 'provider did not create exactly one review task')
  if (!inputEchoMatches(task.data, query)) throw new DataForSeoPublicReviewError('response-identity-drift', 'task submission echo does not match the fixed request')
  const chargedCostUsd = normalizeCost(task.cost, 'task submission cost')
  if (Math.abs(payload.cost - chargedCostUsd) > 1e-9) throw new DataForSeoPublicReviewError('billing-reconciliation-failed', 'root and task submission costs differ')
  if (chargedCostUsd > maxCostUsd) throw new DataForSeoPublicReviewError('cost-bound-exceeded', 'review task cost exceeds the configured bound', { chargedCostUsd, maxCostUsd })
  const submittedAt = now().toISOString()
  return {
    schemaVersion: 'dsh.internal-dataforseo-google-review-task/v1',
    providerTaskId: task.id,
    operationRef: `operation:${sha256(task.id)}`,
    inputDigest: sha256(JSON.stringify(query)),
    input: query,
    chargedCostUsd,
    submittedAt,
  }
}

export async function submitPublicPlaceReviewTask(input, {
  fetchImpl = fetch,
  credentials,
  timeoutMs = 30_000,
  maxResponseBytes = 1_048_576,
  maxCostUsd = MAXIMUM_COST_USD,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  const body = [{ keyword: query.query, location_code: query.locationCode, language_code: query.languageCode, depth: MAX_REVIEWS, sort_by: 'newest', priority: 1 }]
  const payload = await fetchJson(ENDPOINTS.productionPost, { fetchImpl, method: 'POST', body, credentials, timeoutMs, maxResponseBytes, userAgent, stage: 'review task submission' })
  return normalizeTaskSubmission(payload, { input: query, maxCostUsd, now })
}

function parseTimestamp(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null
  if (typeof value !== 'string' || value.length > 64) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is invalid`)
  const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/, '$1T$2$3')
  const time = Date.parse(normalized)
  if (!Number.isFinite(time)) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is invalid`)
  return new Date(time).toISOString()
}

function normalizeRating(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null
  onlyKeys(value, RATING_KEYS, field)
  const rating = Number(value.value)
  const maximum = Number(value.rating_max)
  if (value.rating_type !== 'Max5' || !Number.isFinite(rating) || rating < 0 || rating > 5 || maximum !== 5) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} changed shape`)
  return rating
}

function safeGoogleUrl(value, field) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is invalid`)
  let url
  try { url = new URL(value) } catch { throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is not a URL`) }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || !(host === 'google.com' || host.endsWith('.google.com') || /^www\.google\.[a-z.]{2,}$/.test(host))) throw new DataForSeoPublicReviewError('response-shape-changed', `${field} is outside the reviewed Google origin set`)
  return url.toString()
}

function normalizeReview(item) {
  onlyKeys(item, REVIEW_KEYS, 'review item')
  if (item.type !== 'google_reviews_search' || !Number.isInteger(item.rank_group) || item.rank_group < 1 || !Number.isInteger(item.rank_absolute) || item.rank_absolute < 1) throw new DataForSeoPublicReviewError('response-shape-changed', 'review rank or type changed shape')
  if (typeof item.review_id !== 'string' || item.review_id.length < 8 || item.review_id.length > 2048 || /[\s\0]/.test(item.review_id)) throw new DataForSeoPublicReviewError('response-shape-changed', 'review identity changed shape')
  const original = nullableText(item.original_review_text, 'original review text', 64_000)
  const translated = nullableText(item.review_text, 'review text', 64_000)
  const text = original ?? translated
  const language = item.original_language === null || item.original_language === undefined ? null : singleLine(item.original_language, 'review original language', 35)
  return {
    observationId: sha256(item.review_id),
    rank: item.rank_group,
    rating: normalizeRating(item.rating, 'review rating'),
    publishedAt: parseTimestamp(item.timestamp, 'review timestamp'),
    language,
    text,
    translatedTextAvailable: original !== null && translated !== null && original !== translated,
    sourceReviewUrl: safeGoogleUrl(item.review_url, 'review URL'),
    ownerResponsePresent: typeof item.owner_answer === 'string' && item.owner_answer.length > 0,
  }
}

function normalizeCompletedPayload(payload, { state, environment, now = () => new Date() }) {
  const task = validateRoot(payload)
  validateTaskIdentity(task, state.providerTaskId)
  if (task.status_code === 40601 || task.status_code === 40602) return { status: 'pending', operationRef: state.operationRef, retryAfterSeconds: 60 }
  if (payload.tasks_error !== 0 || task.status_code !== 20000 || task.result_count !== 1 || !Array.isArray(task.result) || task.result.length !== 1) throw new DataForSeoPublicReviewError('provider-error', 'review task failed or did not return exactly one result')
  if (normalizeCost(payload.cost, 'task GET root cost') !== 0 || normalizeCost(task.cost, 'task GET cost') !== 0) throw new DataForSeoPublicReviewError('billing-reconciliation-failed', 'task result retrieval unexpectedly reported a charge')
  if (environment === 'production' && !inputEchoMatches(task.data, state.input)) throw new DataForSeoPublicReviewError('response-identity-drift', 'task result echo does not match the submitted request')
  const result = task.result[0]
  onlyKeys(result, RESULT_KEYS, 'review result')
  if (environment === 'production' && (result.keyword !== state.input.query || result.location_code !== state.input.locationCode || result.language_code !== state.input.languageCode)) throw new DataForSeoPublicReviewError('response-identity-drift', 'review result does not match the submitted query')
  if (!Array.isArray(result.items) || result.items.length > MAX_REVIEWS || !Number.isInteger(result.items_count) || result.items_count !== result.items.length) throw new DataForSeoPublicReviewError('response-shape-changed', 'review item count changed shape or exceeded the bound')
  if (!Number.isInteger(result.reviews_count) || result.reviews_count < result.items_count) throw new DataForSeoPublicReviewError('response-shape-changed', 'place review count changed shape')
  const reviews = result.items.map(normalizeReview).sort((left, right) => left.rank - right.rank)
  if (new Set(reviews.map((item) => item.observationId)).size !== reviews.length || new Set(reviews.map((item) => item.rank)).size !== reviews.length) throw new DataForSeoPublicReviewError('response-shape-changed', 'review identities or ranks are duplicated')
  const placeIdentity = result.place_id ?? result.cid ?? result.feature_id ?? `${result.title}\n${result.sub_title ?? ''}`
  if (typeof placeIdentity !== 'string' || placeIdentity.length < 1 || placeIdentity.length > 4096) throw new DataForSeoPublicReviewError('response-shape-changed', 'place identity changed shape')
  const observedAt = parseTimestamp(result.datetime, 'result datetime')
  const collectedAt = now().toISOString()
  const output = {
    schemaVersion: 'dsh.transient-deidentified-public-place-review-snapshot/v1',
    query: { query: state.input.query, locationCode: state.input.locationCode, languageCode: state.input.languageCode, limit: MAX_REVIEWS, sort: 'newest' },
    place: {
      observationId: sha256(placeIdentity),
      displayName: nullableText(result.title, 'place title', 2000),
      addressLabel: nullableText(result.sub_title, 'place subtitle', 4000),
      rating: normalizeRating(result.rating, 'place rating', { optional: true }),
      reviewCount: result.reviews_count,
    },
    reviews,
    coverage: {
      representation: environment === 'sandbox' ? 'synthetic-provider-shape-only' : 'single-provider-google-serp-review-sample',
      requestedLimit: MAX_REVIEWS,
      returnedCount: reviews.length,
      totalReviewCountIsProviderObservation: true,
      complete: false,
      order: 'newest-first',
      placeResolution: 'provider-keyword-resolution',
      placeIdentityConfirmedByCaller: false,
      personalizedFactorsIncluded: false,
    },
    authorization: { supplierAccessVerifiedByResponse: true, targetPlatformAuthorizationVerified: false, callerResponsibleForTargetTermsAndRights: true },
    retention: {
      mode: 'transient-deidentified-research',
      verbatimMayContainSelfDisclosedPersonalData: true,
      reviewerIdentityRetained: false,
      identityGraphAllowed: false,
      durableVerbatimAllowed: false,
      durableResearchOutput: 'reviewed-non-verbatim-deidentified-paraphrase-and-evidence-reference-only',
    },
    billing: { currency: 'USD', chargedCost: environment === 'production' ? state.chargedCostUsd : 0, maximumCost: MAXIMUM_COST_USD, resultRetrievalCharged: false, reconciled: true },
    observedAt,
    collectedAt,
  }
  const assertions = [
    { id: 'bounded-newest-sample', passed: reviews.length <= MAX_REVIEWS && output.coverage.order === 'newest-first' },
    { id: 'corpus-incomplete', passed: output.coverage.complete === false },
    { id: 'reviewer-identity-removed', passed: !/profile_name|profile_url|profile_image_url|local_guide|photos_count|reviews_count/.test(JSON.stringify(reviews)) },
    { id: 'owner-response-text-removed', passed: !/owner_answer|original_owner_answer/.test(JSON.stringify(reviews)) },
    { id: 'target-authorization-not-invented', passed: output.authorization.targetPlatformAuthorizationVerified === false },
    { id: 'transient-retention', passed: output.retention.durableVerbatimAllowed === false && output.retention.identityGraphAllowed === false },
    { id: 'billing-reconciled', passed: output.billing.chargedCost <= output.billing.maximumCost && output.billing.resultRetrievalCharged === false },
  ]
  return { status: 'completed', operationRef: state.operationRef, output: { ...output, conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } } }
}

export async function readSubmittedPublicPlaceReviewSnapshot(state, {
  fetchImpl = fetch,
  credentials,
  environment = 'production',
  timeoutMs = 30_000,
  maxResponseBytes = 4_194_304,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  if (!state || state.schemaVersion !== 'dsh.internal-dataforseo-google-review-task/v1' || !UUID_PATTERN.test(state.providerTaskId) || !/^operation:[a-f0-9]{64}$/.test(state.operationRef)) throw new DataForSeoPublicReviewError('invalid-operation-state', 'internal review task state is invalid')
  if (!['production', 'sandbox'].includes(environment)) throw new DataForSeoPublicReviewError('configuration-error', `unsupported environment: ${environment}`)
  const url = environment === 'sandbox' ? ENDPOINTS.sandboxGet : `${ENDPOINTS.productionGetBase}${encodeURIComponent(state.providerTaskId)}`
  const payload = await fetchJson(url, { fetchImpl, credentials, timeoutMs, maxResponseBytes, userAgent, stage: 'review task result' })
  return normalizeCompletedPayload(payload, { state, environment, now })
}

export function redactForVerification(output) {
  if (!output || output.schemaVersion !== 'dsh.transient-deidentified-public-place-review-snapshot/v1' || output.conformance?.status !== 'passed') throw new DataForSeoPublicReviewError('invalid-verification-output', 'only a conforming transient snapshot can be redacted')
  return {
    schemaVersion: 'dsh.probe-redaction/dataforseo-google-public-reviews/v1',
    coverage: { representation: output.coverage.representation, requestedLimit: output.coverage.requestedLimit, returnedCount: output.coverage.returnedCount, complete: false, order: output.coverage.order },
    retention: { reviewerIdentityRetained: false, durableVerbatimAllowed: false, identityGraphAllowed: false },
    authorization: { targetPlatformAuthorizationVerified: false },
    billing: output.billing,
    observedAt: output.observedAt,
    checks: output.conformance.assertions,
    redacted: ['query', 'place', 'review-text', 'review-rating', 'review-time', 'review-link', 'review-observation-id', 'operation-ref', 'raw-result-digest', 'reviewer-identity', 'owner-response'],
  }
}

export async function readPublicPlaceReviewSnapshot(input, {
  environment = 'sandbox',
  awaitTaskResult,
  ...options
} = {}) {
  const query = normalizeInput(input)
  if (environment === 'sandbox') {
    const taskId = '00000000-0000-0000-0000-000000000000'
    const state = { schemaVersion: 'dsh.internal-dataforseo-google-review-task/v1', providerTaskId: taskId, operationRef: `operation:${sha256(taskId)}`, inputDigest: sha256(JSON.stringify(query)), input: query, chargedCostUsd: 0, submittedAt: options.now?.().toISOString() ?? new Date().toISOString() }
    const result = await readSubmittedPublicPlaceReviewSnapshot(state, { ...options, environment: 'sandbox' })
    if (result.status !== 'completed') throw new DataForSeoPublicReviewError('sandbox-shape-changed', 'sandbox result unexpectedly remained pending')
    return result.output
  }
  if (environment !== 'production') throw new DataForSeoPublicReviewError('configuration-error', `unsupported environment: ${environment}`)
  if (typeof awaitTaskResult !== 'function') throw new DataForSeoPublicReviewError('workflow-runtime-unavailable', 'production review tasks require a suspend/resume task executor before submission')
  const state = await submitPublicPlaceReviewTask(query, options)
  const outcome = await awaitTaskResult({ operationRef: state.operationRef, deadlineSeconds: TASK_RESULT_DEADLINE_SECONDS, readOnce: () => readSubmittedPublicPlaceReviewSnapshot(state, { ...options, environment: 'production' }) })
  if (!outcome || outcome.status !== 'completed') throw new DataForSeoPublicReviewError('operation-pending', 'review task has not completed within the executor window', { operationRef: state.operationRef })
  return outcome.output
}

import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.appfigures.com/v2'
export const MAX_REVIEW_TEXT_LENGTH = 16_000
export const EXPECTED_CREDITS_PER_INVOCATION = 5

const ALLOWED_INPUT_KEYS = new Set(['store', 'appId', 'country', 'startDate', 'endDate', 'stars', 'query', 'limit'])
const STORES = new Set(['apple', 'google_play'])

export class PublicAppReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'PublicAppReviewError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function boundedString(value, field, maximum, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return null
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum || /[\r\n\0]/.test(value)) {
    throw new PublicAppReviewError('invalid-input', `${field} must be a non-empty single-line string up to ${maximum} characters`)
  }
  return value.trim()
}

function parseDateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PublicAppReviewError('invalid-input', `${field} must use YYYY-MM-DD`)
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new PublicAppReviewError('invalid-input', `${field} is invalid`)
  return { value, timestamp }
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PublicAppReviewError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new PublicAppReviewError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (!STORES.has(input.store)) throw new PublicAppReviewError('invalid-input', `unsupported store: ${input.store}`)
  const appId = boundedString(input.appId, 'appId', 255)
  if (input.store === 'apple' && !/^[1-9][0-9]{5,19}$/.test(appId)) throw new PublicAppReviewError('invalid-input', 'Apple appId must be a numeric store ID')
  if (input.store === 'google_play' && !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/.test(appId)) throw new PublicAppReviewError('invalid-input', 'Google Play appId must be a package name')
  let country = input.country ?? null
  if (input.store === 'apple') {
    country = boundedString(country, 'country', 2)
    if (!/^[A-Z]{2}$/.test(country) || country === 'ZZ') throw new PublicAppReviewError('invalid-input', 'Apple country must be a two-letter uppercase territory code')
  } else if (country !== null) {
    throw new PublicAppReviewError('invalid-input', 'Google Play reviews do not support country filtering')
  }
  const start = parseDateOnly(input.startDate, 'startDate')
  const end = parseDateOnly(input.endDate, 'endDate')
  const spanDays = Math.floor((end.timestamp - start.timestamp) / 86_400_000) + 1
  if (spanDays < 1 || spanDays > 90) throw new PublicAppReviewError('invalid-input', 'review window must contain between 1 and 90 days')
  const stars = input.stars ?? []
  if (!Array.isArray(stars) || stars.length > 5 || stars.some((value) => !Number.isInteger(value) || value < 1 || value > 5) || new Set(stars).size !== stars.length) {
    throw new PublicAppReviewError('invalid-input', 'stars must contain unique integers from 1 through 5')
  }
  const query = boundedString(input.query, 'query', 200, { optional: true })
  const limit = input.limit ?? 25
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new PublicAppReviewError('financial-policy', 'limit must be an integer between 1 and 25')
  return { store: input.store, appId, country, startDate: start.value, endDate: end.value, stars: [...stars].sort(), query, limit }
}

function normalizeToken(credentials) {
  const token = credentials?.token
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048 || /[\s\0]/.test(token)) throw new PublicAppReviewError('credential-unavailable', 'provider Personal Access Token is unavailable')
  return token
}

async function readJsonWithLimit(response, maxResponseBytes) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new PublicAppReviewError('response-too-large', `app data response exceeds ${maxResponseBytes} bytes`)
  if (!response.body) throw new PublicAppReviewError('response-shape-changed', 'app data response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxResponseBytes) {
      await reader.cancel()
      throw new PublicAppReviewError('response-too-large', `app data response exceeds ${maxResponseBytes} bytes`)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    throw new PublicAppReviewError('response-shape-changed', 'app data response is not valid JSON')
  }
}

async function fetchJson(url, { fetchImpl, token, timeoutMs, maxResponseBytes, userAgent, stage }) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${token}`, 'user-agent': userAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 202 && stage === 'product') throw new PublicAppReviewError('product-resolution-pending', 'store product resolution is still pending; do not poll automatically')
  if (!response.ok) {
    const code = response.status === 401 ? 'authentication-failed'
      : response.status === 402 || response.status === 403 ? 'access-or-credit-required'
        : response.status === 404 ? 'product-not-found'
          : response.status === 429 ? 'rate-limited'
            : 'http-error'
    throw new PublicAppReviewError(code, `${stage} request failed: HTTP_${response.status}`, { status: response.status, stage })
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new PublicAppReviewError('response-shape-changed', `${stage} response returned ${contentType || 'no content type'}`)
  return readJsonWithLimit(response, maxResponseBytes)
}

function normalizeProduct(product, query) {
  const valid = product && Number.isInteger(product.id) && product.id > 0 && product.store === query.store
    && typeof product.name === 'string' && product.name.length > 0 && product.name.length <= 1000
    && typeof product.developer === 'string' && product.developer.length <= 1000
  if (!valid) throw new PublicAppReviewError('response-shape-changed', 'product response shape changed')
  const externalId = query.store === 'apple'
    ? String(product.ref_no ?? product.vendor_identifier ?? '')
    : String(product.package_name ?? product.sku ?? product.vendor_identifier ?? '')
  if (externalId !== query.appId) throw new PublicAppReviewError('response-identity-drift', 'resolved product does not match the requested store identifier')
  return { internalId: product.id, name: product.name, developer: product.developer }
}

function sourceTimestamp(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) throw new PublicAppReviewError('response-shape-changed', 'review date is invalid')
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const timestamp = Date.parse(withZone)
  if (!Number.isFinite(timestamp)) throw new PublicAppReviewError('response-shape-changed', 'review date is invalid')
  return new Date(timestamp).toISOString()
}

function nullableText(value, field, maximum) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maximum) throw new PublicAppReviewError('response-shape-changed', `${field} is invalid`)
  return value
}

function retainedText(value) {
  const full = value ?? ''
  const retained = full.slice(0, MAX_REVIEW_TEXT_LENGTH)
  return { retained: true, value: retained, length: full.length, sha256: sha256(full), truncated: retained.length !== full.length }
}

function normalizeReview(review, { productId, query }) {
  const rawId = review?.id
  if ((typeof rawId !== 'string' && typeof rawId !== 'number') || String(rawId).length < 1 || String(rawId).length > 512 || review.product !== productId) {
    throw new PublicAppReviewError('response-identity-drift', 'review identity does not match the resolved product')
  }
  const stars = Number(review.stars)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new PublicAppReviewError('response-shape-changed', 'review stars are invalid')
  const iso = nullableText(review.iso, 'review iso', 16)
  if (query.store === 'apple' && iso !== query.country) throw new PublicAppReviewError('response-identity-drift', 'Apple review territory does not match the request')
  if (query.store === 'google_play' && iso !== 'ZZ') throw new PublicAppReviewError('response-shape-changed', 'Google Play review region semantics changed')
  const title = nullableText(review.title, 'review title', 16_000)
  const body = nullableText(review.review, 'review body', 64_000)
  if (body === null) throw new PublicAppReviewError('response-shape-changed', 'review body is missing')
  const predictedLanguages = review.predicted_langs === undefined || review.predicted_langs === null
    ? []
    : review.predicted_langs
  if (!Array.isArray(predictedLanguages) || predictedLanguages.length > 20 || predictedLanguages.some((value) => typeof value !== 'string' || value.length < 1 || value.length > 32)) {
    throw new PublicAppReviewError('response-shape-changed', 'predicted review languages changed shape')
  }
  return {
    observationId: sha256(`${query.store}\0${query.appId}\0${rawId}`),
    rating: stars,
    appVersion: nullableText(review.version, 'review version', 256),
    region: iso,
    regionSemantics: query.store === 'apple' ? 'app-store-territory' : 'country-unavailable',
    predictedLanguages,
    title: retainedText(title),
    body: retainedText(body),
    publishedAt: sourceTimestamp(review.date),
  }
}

export function normalizeReviewSnapshot({ productPayload, reviewsPayload }, { input, now = () => new Date() } = {}) {
  const query = normalizeInput(input)
  const product = normalizeProduct(productPayload, query)
  const envelopeValid = reviewsPayload && Number.isInteger(reviewsPayload.total) && reviewsPayload.total >= 0
    && Number.isInteger(reviewsPayload.pages) && reviewsPayload.pages >= 0 && reviewsPayload.this_page === 1
    && Array.isArray(reviewsPayload.reviews) && reviewsPayload.reviews.length <= query.limit
  if (!envelopeValid) throw new PublicAppReviewError('response-shape-changed', 'reviews response shape changed')
  const reviews = reviewsPayload.reviews.map((review) => normalizeReview(review, { productId: product.internalId, query }))
  const descending = reviews.every((review, index) => index === 0 || review.publishedAt <= reviews[index - 1].publishedAt)
  const projection = {
    source: {
      store: query.store,
      appId: query.appId,
      productName: product.name,
      developer: product.developer,
    },
    query,
    coverage: {
      representation: 'bounded-public-review-snapshot',
      sourceReportedTotal: reviewsPayload.total,
      sourceReportedPages: reviewsPayload.pages,
      returnedCount: reviews.length,
      complete: reviewsPayload.total <= reviews.length,
      authorIdentityRetained: false,
      developerResponseStatus: 'unavailable-for-public-competitor',
      reviewTextRetention: 'transient',
    },
    billing: {
      unit: 'public-data-credit',
      expectedMaximumCredits: EXPECTED_CREDITS_PER_INVOCATION,
      actualCredits: null,
      reconciled: false,
    },
    reviews,
    observedAt: now().toISOString(),
  }
  const serialized = JSON.stringify(projection)
  const assertions = [
    { id: 'bounded-page', passed: reviews.length <= query.limit && query.limit <= 25 },
    { id: 'newest-first', passed: descending },
    { id: 'author-identity-removed', passed: reviews.every((review) => !Object.hasOwn(review, 'author')) && projection.coverage.authorIdentityRetained === false },
    { id: 'response-status-unavailable', passed: !serialized.includes('has_response') && projection.coverage.developerResponseStatus === 'unavailable-for-public-competitor' },
    { id: 'provider-product-id-hidden', passed: !serialized.includes(`"${product.internalId}"`) && !serialized.includes(`:${product.internalId}`) },
    { id: 'credit-bound-declared', passed: projection.billing.expectedMaximumCredits === 5 },
  ]
  return {
    ...projection,
    resultDigest: sha256(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicAppReviewSnapshot(input, {
  fetchImpl = fetch,
  credentials,
  timeoutMs = 30_000,
  maxResponseBytes = 2_097_152,
  maxCreditsPerInvocation = 5,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  const token = normalizeToken(credentials)
  if (maxCreditsPerInvocation !== EXPECTED_CREDITS_PER_INVOCATION) throw new PublicAppReviewError('configuration-error', 'maxCreditsPerInvocation must remain fixed at 5')
  const productUrl = new URL(`${API_BASE_URL}/products/${query.store}/${encodeURIComponent(query.appId)}`)
  const productPayload = await fetchJson(productUrl, { fetchImpl, token, timeoutMs, maxResponseBytes, userAgent, stage: 'product' })
  const product = normalizeProduct(productPayload, query)
  const reviewsUrl = new URL(`${API_BASE_URL}/reviews`)
  reviewsUrl.searchParams.set('products', String(product.internalId))
  reviewsUrl.searchParams.set('page', '1')
  reviewsUrl.searchParams.set('count', String(query.limit))
  reviewsUrl.searchParams.set('sort', '-date')
  reviewsUrl.searchParams.set('start', query.startDate)
  reviewsUrl.searchParams.set('end', query.endDate)
  if (query.country) reviewsUrl.searchParams.set('countries', query.country)
  if (query.stars.length > 0) reviewsUrl.searchParams.set('stars', query.stars.join(','))
  if (query.query) reviewsUrl.searchParams.set('q', query.query)
  const reviewsPayload = await fetchJson(reviewsUrl, { fetchImpl, token, timeoutMs, maxResponseBytes, userAgent, stage: 'reviews' })
  return normalizeReviewSnapshot({ productPayload, reviewsPayload }, { input: query, now })
}

export function redactReviewTextForVerification(result) {
  return {
    ...result,
    coverage: { ...result.coverage, reviewTextRetention: 'redacted' },
    reviews: result.reviews.map((review) => ({
      ...review,
      title: { retained: false, length: review.title.length, sha256: review.title.sha256, truncated: review.title.truncated },
      body: { retained: false, length: review.body.length, sha256: review.body.sha256, truncated: review.body.truncated },
    })),
  }
}

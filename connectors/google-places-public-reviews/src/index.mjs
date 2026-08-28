import { createHash } from 'node:crypto'

export const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
export const PLACE_DETAILS_BASE_URL = 'https://places.googleapis.com/v1/places/'
export const TEXT_SEARCH_FIELD_MASK = 'places.id'
export const PLACE_DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,types,googleMapsUri,rating,userRatingCount,reviews,attributions'
export const MAX_REVIEWS = 5
export const MAXIMUM_COST_USD = 0.03

const ALLOWED_INPUT_KEYS = new Set(['query', 'locationBias', 'languageCode', 'regionCode', 'limit', 'usageMode', 'acknowledgeAttributionDisplay', 'acknowledgeNoDurableRetention'])
const ALLOWED_LOCATION_KEYS = new Set(['latitude', 'longitude', 'radiusMeters'])
const GOOGLE_HOSTS = new Set(['www.google.com', 'google.com', 'maps.google.com'])
const GOOGLE_IMAGE_HOSTS = new Set(['lh3.googleusercontent.com'])

export class PublicPlaceReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'PublicPlaceReviewError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function boundedSingleLine(value, field, maximum) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum || /[\r\n\0]/.test(value)) {
    throw new PublicPlaceReviewError('invalid-input', `${field} must be a non-empty single-line string up to ${maximum} characters`)
  }
  return value.trim()
}

function finiteNumber(value, field, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new PublicPlaceReviewError('invalid-input', `${field} must be between ${minimum} and ${maximum}`)
  }
  return value
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PublicPlaceReviewError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new PublicPlaceReviewError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (!input.locationBias || typeof input.locationBias !== 'object' || Array.isArray(input.locationBias)) throw new PublicPlaceReviewError('invalid-input', 'locationBias is required')
  const unknownLocation = Object.keys(input.locationBias).filter((key) => !ALLOWED_LOCATION_KEYS.has(key))
  if (unknownLocation.length > 0) throw new PublicPlaceReviewError('invalid-input', `unknown locationBias fields: ${unknownLocation.join(', ')}`)
  const languageCode = boundedSingleLine(input.languageCode, 'languageCode', 35)
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(languageCode)) throw new PublicPlaceReviewError('invalid-input', 'languageCode must be a bounded BCP 47-style tag')
  const regionCode = boundedSingleLine(input.regionCode, 'regionCode', 2).toUpperCase()
  if (!/^[A-Z]{2}$/.test(regionCode)) throw new PublicPlaceReviewError('invalid-input', 'regionCode must be a two-character CLDR region code')
  const limit = input.limit ?? MAX_REVIEWS
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_REVIEWS) throw new PublicPlaceReviewError('invalid-input', `limit must be an integer from 1 through ${MAX_REVIEWS}`)
  if (input.usageMode !== 'ephemeral-attributed-research') throw new PublicPlaceReviewError('policy-not-acknowledged', 'usageMode must be ephemeral-attributed-research')
  if (input.acknowledgeAttributionDisplay !== true) throw new PublicPlaceReviewError('policy-not-acknowledged', 'Google Maps and review author attribution display must be acknowledged')
  if (input.acknowledgeNoDurableRetention !== true) throw new PublicPlaceReviewError('policy-not-acknowledged', 'the no-durable-retention boundary must be acknowledged')
  return {
    query: boundedSingleLine(input.query, 'query', 200),
    locationBias: {
      latitude: finiteNumber(input.locationBias.latitude, 'locationBias.latitude', -90, 90),
      longitude: finiteNumber(input.locationBias.longitude, 'locationBias.longitude', -180, 180),
      radiusMeters: finiteNumber(input.locationBias.radiusMeters, 'locationBias.radiusMeters', 1, 50_000),
    },
    languageCode,
    regionCode,
    limit,
    usageMode: input.usageMode,
    acknowledgeAttributionDisplay: true,
    acknowledgeNoDurableRetention: true,
  }
}

function normalizeApiKey(credentials) {
  const apiKey = credentials?.apiKey
  if (typeof apiKey !== 'string' || apiKey.length < 20 || apiKey.length > 2048 || /[\s\0]/.test(apiKey)) {
    throw new PublicPlaceReviewError('credential-unavailable', 'approved Google Maps Platform API key is unavailable')
  }
  return apiKey
}

async function readJsonWithLimit(response, maxResponseBytes, stage) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new PublicPlaceReviewError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
  if (!response.body) throw new PublicPlaceReviewError('response-shape-changed', `${stage} response has no body`)
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxResponseBytes) {
      await reader.cancel()
      throw new PublicPlaceReviewError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    throw new PublicPlaceReviewError('response-shape-changed', `${stage} response is not valid JSON`)
  }
}

async function fetchJson(url, { fetchImpl, apiKey, method, body, fieldMask, timeoutMs, maxResponseBytes, stage }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-goog-api-key': apiKey,
      'x-goog-fieldmask': fieldMask,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 400 ? 'invalid-provider-request'
      : response.status === 401 || response.status === 403 ? 'authentication-or-api-access-failed'
        : response.status === 404 ? 'place-not-found'
          : response.status === 429 ? 'rate-limited'
            : 'http-error'
    throw new PublicPlaceReviewError(code, `${stage} request failed: HTTP_${response.status}`, { stage, status: response.status })
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new PublicPlaceReviewError('response-shape-changed', `${stage} response returned ${contentType || 'no content type'}`)
  return readJsonWithLimit(response, maxResponseBytes, stage)
}

function onlyKeys(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicPlaceReviewError('response-shape-changed', `${field} must be an object`)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new PublicPlaceReviewError('response-shape-changed', `${field} returned unexpected fields: ${unknown.join(', ')}`)
}

function safeUrl(value, field, { images = false } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) throw new PublicPlaceReviewError('response-shape-changed', `${field} is invalid`)
  let url
  try { url = new URL(value) } catch { throw new PublicPlaceReviewError('response-shape-changed', `${field} is not a URL`) }
  const hosts = images ? GOOGLE_IMAGE_HOSTS : GOOGLE_HOSTS
  if (url.protocol !== 'https:' || !hosts.has(url.hostname)) throw new PublicPlaceReviewError('response-shape-changed', `${field} is outside the reviewed Google origin set`)
  return url.toString()
}

function localizedText(value, field, { optional = false } = {}) {
  if (optional && value === undefined) return null
  onlyKeys(value, new Set(['text', 'languageCode']), field)
  const text = typeof value.text === 'string' && value.text.length <= 64_000 ? value.text : null
  const languageCode = typeof value.languageCode === 'string' && value.languageCode.length <= 35 ? value.languageCode : null
  if (text === null || languageCode === null) throw new PublicPlaceReviewError('response-shape-changed', `${field} text or language changed shape`)
  return { text, languageCode }
}

function timestamp(value, field) {
  if (typeof value !== 'string' || value.length > 64 || !Number.isFinite(Date.parse(value))) throw new PublicPlaceReviewError('response-shape-changed', `${field} is invalid`)
  return new Date(value).toISOString()
}

function visitDate(value, field) {
  if (value === undefined) return null
  onlyKeys(value, new Set(['year', 'month', 'day']), field)
  if (!Number.isInteger(value.year) || value.year < 1 || value.year > 9999 || !Number.isInteger(value.month) || value.month < 1 || value.month > 12 || !Number.isInteger(value.day) || value.day !== 0) {
    throw new PublicPlaceReviewError('response-shape-changed', `${field} must contain provider year/month with day zero`)
  }
  return { year: value.year, month: value.month }
}

function normalizeAuthor(value, field) {
  onlyKeys(value, new Set(['displayName', 'uri', 'photoUri']), field)
  return {
    displayName: boundedProviderString(value.displayName, `${field}.displayName`, 500),
    uri: safeUrl(value.uri, `${field}.uri`),
    photoUri: safeUrl(value.photoUri, `${field}.photoUri`, { images: true }),
  }
}

function boundedProviderString(value, field, maximum, { optional = false } = {}) {
  if (optional && value === undefined) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || value.includes('\0')) throw new PublicPlaceReviewError('response-shape-changed', `${field} is invalid`)
  return value
}

function normalizeReview(review, placeId) {
  onlyKeys(review, new Set(['name', 'relativePublishTimeDescription', 'text', 'originalText', 'rating', 'authorAttribution', 'publishTime', 'flagContentUri', 'googleMapsUri', 'visitDate']), 'review')
  const name = boundedProviderString(review.name, 'review.name', 1024)
  if (!name.startsWith(`places/${placeId}/reviews/`)) throw new PublicPlaceReviewError('response-identity-drift', 'review does not belong to the resolved place')
  const rating = Number(review.rating)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new PublicPlaceReviewError('response-shape-changed', 'review.rating is invalid')
  const text = localizedText(review.text, 'review.text', { optional: true })
  const originalText = localizedText(review.originalText, 'review.originalText', { optional: true })
  return {
    observationId: sha256(name),
    rating,
    text,
    originalText,
    translated: Boolean(text && originalText && (text.languageCode !== originalText.languageCode || text.text !== originalText.text)),
    relativePublishTimeDescription: boundedProviderString(review.relativePublishTimeDescription, 'review.relativePublishTimeDescription', 200),
    publishedAt: timestamp(review.publishTime, 'review.publishTime'),
    visitDate: visitDate(review.visitDate, 'review.visitDate'),
    authorAttribution: normalizeAuthor(review.authorAttribution, 'review.authorAttribution'),
    sourceReviewUri: safeUrl(review.googleMapsUri, 'review.googleMapsUri'),
    flagContentUri: safeUrl(review.flagContentUri, 'review.flagContentUri'),
  }
}

function normalizeAttribution(value) {
  onlyKeys(value, new Set(['provider', 'providerUri']), 'place.attribution')
  return {
    provider: boundedProviderString(value.provider, 'place.attribution.provider', 500),
    providerUri: safeUrl(value.providerUri, 'place.attribution.providerUri'),
  }
}

function normalizeSearchPayload(payload) {
  onlyKeys(payload, new Set(['places']), 'text search response')
  if (!Array.isArray(payload.places) || payload.places.length !== 1) throw new PublicPlaceReviewError('place-resolution-ambiguous', 'text search must return exactly one bounded first result')
  onlyKeys(payload.places[0], new Set(['id']), 'text search place')
  const placeId = boundedProviderString(payload.places[0].id, 'text search place.id', 255)
  if (!/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) throw new PublicPlaceReviewError('response-shape-changed', 'text search place.id is invalid')
  return placeId
}

export function normalizeObservation({ searchPayload, detailsPayload }, { input, now = () => new Date() } = {}) {
  const query = normalizeInput(input)
  const placeId = normalizeSearchPayload(searchPayload)
  onlyKeys(detailsPayload, new Set(['id', 'displayName', 'formattedAddress', 'types', 'googleMapsUri', 'rating', 'userRatingCount', 'reviews', 'attributions']), 'place details response')
  if (detailsPayload.id !== placeId) throw new PublicPlaceReviewError('response-identity-drift', 'Place Details identity does not match Text Search')
  const types = detailsPayload.types ?? []
  if (!Array.isArray(types) || types.length > 50 || types.some((value) => typeof value !== 'string' || value.length < 1 || value.length > 100)) throw new PublicPlaceReviewError('response-shape-changed', 'place types changed shape')
  const rawReviews = detailsPayload.reviews ?? []
  if (!Array.isArray(rawReviews) || rawReviews.length > MAX_REVIEWS) throw new PublicPlaceReviewError('response-shape-changed', 'Place Details returned more than the reviewed maximum of five reviews')
  const rawAttributions = detailsPayload.attributions ?? []
  if (!Array.isArray(rawAttributions) || rawAttributions.length > 20) throw new PublicPlaceReviewError('response-shape-changed', 'place attributions changed shape')
  const rating = detailsPayload.rating === undefined ? null : Number(detailsPayload.rating)
  if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) throw new PublicPlaceReviewError('response-shape-changed', 'place rating is invalid')
  const userRatingCount = detailsPayload.userRatingCount === undefined ? null : detailsPayload.userRatingCount
  if (userRatingCount !== null && (!Number.isInteger(userRatingCount) || userRatingCount < 0)) throw new PublicPlaceReviewError('response-shape-changed', 'place userRatingCount is invalid')
  const reviews = rawReviews.slice(0, query.limit).map((review) => normalizeReview(review, placeId))
  const observedAt = now().toISOString()
  const projection = {
    schemaVersion: 'dsh.transient-attributed-public-place-review-observation/v1',
    query: {
      query: query.query,
      locationBias: query.locationBias,
      languageCode: query.languageCode,
      regionCode: query.regionCode,
      limit: query.limit,
    },
    place: {
      observationId: sha256(placeId),
      displayName: localizedText(detailsPayload.displayName, 'place.displayName'),
      formattedAddress: boundedProviderString(detailsPayload.formattedAddress, 'place.formattedAddress', 2000, { optional: true }),
      types,
      googleMapsUri: safeUrl(detailsPayload.googleMapsUri, 'place.googleMapsUri'),
      rating,
      userRatingCount,
      dataProviderAttributions: rawAttributions.map(normalizeAttribution),
    },
    reviews,
    coverage: {
      representation: 'provider-relevance-sample',
      requestedLimit: query.limit,
      returnedCount: reviews.length,
      providerMaximum: MAX_REVIEWS,
      complete: false,
      order: 'provider-relevance',
      placeResolution: 'first-text-search-result',
      placeIdentityConfirmedByCaller: false,
      locationBiasMayBeOverriddenByExplicitQuery: true,
      textualReviewCount: reviews.filter((review) => review.text !== null).length,
    },
    displayRequirements: {
      googleMapsAttributionRequired: true,
      authorAttributionRequired: true,
      directReviewLinkRequired: true,
      orderNoticeRequired: true,
      franceVisitDateRequiredWhenPresent: true,
      translationNoticeRecommended: true,
      contentReportingRecommended: true,
    },
    retention: {
      mode: 'ephemeral-attributed-display-only',
      durableProviderContentAllowed: false,
      placeIdCachingExceptionNotUsedByOutput: true,
      identityGraphAllowed: false,
      durableResearchOutput: 'deidentified-paraphrase-and-evidence-reference-only-after-review',
    },
    billing: {
      placeResolutionSku: 'places-api-text-search-essentials-ids-only',
      placeResolutionCurrentPrice: 'unlimited-no-charge',
      reviewSku: 'places-api-place-details-enterprise-plus-atmosphere',
      currentMonthlyFreeUsageCap: 1000,
      currentUsdPerThousandBeyondFreeCap: 25,
      maximumBillableRequests: 1,
      maximumCostUsd: MAXIMUM_COST_USD,
      reconciled: false,
    },
    observedAt,
  }
  const serialized = JSON.stringify(projection)
  const assertions = [
    { id: 'bounded-relevance-sample', passed: reviews.length <= query.limit && query.limit <= MAX_REVIEWS && projection.coverage.complete === false },
    { id: 'complete-author-attribution', passed: reviews.every((review) => review.authorAttribution.displayName && review.authorAttribution.uri && review.authorAttribution.photoUri) },
    { id: 'direct-source-links', passed: reviews.every((review) => review.sourceReviewUri && review.flagContentUri) },
    { id: 'ephemeral-only', passed: projection.retention.mode === 'ephemeral-attributed-display-only' && projection.retention.durableProviderContentAllowed === false },
    { id: 'identity-graph-blocked', passed: projection.retention.identityGraphAllowed === false },
    { id: 'provider-credentials-hidden', passed: !/x-goog-api-key|credential|apiKey/i.test(serialized) },
  ]
  return {
    ...projection,
    resultDigest: sha256(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicPlaceReviewSnapshot(input, {
  fetchImpl = fetch,
  credentials,
  timeoutMs = 30_000,
  maxResponseBytes = 524_288,
  maximumBillableRequests = 1,
  maximumCostUsd = MAXIMUM_COST_USD,
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  const apiKey = normalizeApiKey(credentials)
  if (maximumBillableRequests !== 1 || maximumCostUsd !== MAXIMUM_COST_USD) throw new PublicPlaceReviewError('configuration-error', 'billable request and cost bounds must remain fixed at one and USD 0.03')
  const searchPayload = await fetchJson(TEXT_SEARCH_URL, {
    fetchImpl,
    apiKey,
    method: 'POST',
    body: {
      textQuery: query.query,
      pageSize: 1,
      languageCode: query.languageCode,
      regionCode: query.regionCode,
      locationBias: {
        circle: {
          center: { latitude: query.locationBias.latitude, longitude: query.locationBias.longitude },
          radius: query.locationBias.radiusMeters,
        },
      },
    },
    fieldMask: TEXT_SEARCH_FIELD_MASK,
    timeoutMs,
    maxResponseBytes,
    stage: 'text-search',
  })
  const placeId = normalizeSearchPayload(searchPayload)
  const detailsUrl = new URL(`${PLACE_DETAILS_BASE_URL}${encodeURIComponent(placeId)}`)
  detailsUrl.searchParams.set('languageCode', query.languageCode)
  detailsUrl.searchParams.set('regionCode', query.regionCode)
  const detailsPayload = await fetchJson(detailsUrl, {
    fetchImpl,
    apiKey,
    method: 'GET',
    fieldMask: PLACE_DETAILS_FIELD_MASK,
    timeoutMs,
    maxResponseBytes,
    stage: 'place-details',
  })
  return normalizeObservation({ searchPayload, detailsPayload }, { input: query, now })
}

export function redactForVerification(result) {
  const assertions = {
    placeReturned: Boolean(result?.place),
    reviewCount: Array.isArray(result?.reviews) ? result.reviews.length : 0,
    textualReviewCount: result?.coverage?.textualReviewCount ?? 0,
    authorAttributionObserved: Array.isArray(result?.reviews) && result.reviews.every((review) => Boolean(review.authorAttribution?.displayName && review.authorAttribution?.uri && review.authorAttribution?.photoUri)),
    directReviewLinksObserved: Array.isArray(result?.reviews) && result.reviews.every((review) => Boolean(review.sourceReviewUri)),
    order: result?.coverage?.order,
    complete: result?.coverage?.complete,
    ephemeralOnly: result?.retention?.mode === 'ephemeral-attributed-display-only' && result?.retention?.durableProviderContentAllowed === false,
    identityGraphAllowed: result?.retention?.identityGraphAllowed,
  }
  const redacted = {
    schemaVersion: 'dsh.google-places-public-reviews-verification-redaction/v1',
    inputDigest: sha256(JSON.stringify(result?.query ?? null)),
    assertions,
    billing: result?.billing,
    observedAt: result?.observedAt,
    conformance: result?.conformance,
  }
  return { ...redacted, verificationDigest: sha256(JSON.stringify(redacted)) }
}

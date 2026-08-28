import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://store.steampowered.com'
export const DOCUMENTATION_URL = 'https://partner.steamgames.com/doc/store/getreviews'
export const MAX_REVIEW_TEXT_LENGTH = 16_000

const ALLOWED_INPUT_KEYS = new Set(['appId', 'filter', 'language', 'reviewType', 'purchaseType', 'cursor', 'perPage', 'includeOfftopic'])
const FILTERS = new Set(['recent', 'updated'])
const REVIEW_TYPES = new Set(['all', 'positive', 'negative'])
const PURCHASE_TYPES = new Set(['all', 'steam', 'non_steam_purchase'])

export class SteamPublicReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'SteamPublicReviewError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SteamPublicReviewError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new SteamPublicReviewError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  const appId = input.appId
  const filter = input.filter ?? 'updated'
  const language = input.language ?? 'all'
  const reviewType = input.reviewType ?? 'all'
  const purchaseType = input.purchaseType ?? 'all'
  const cursor = input.cursor ?? '*'
  const perPage = input.perPage ?? 20
  const includeOfftopic = input.includeOfftopic ?? false
  if (!Number.isInteger(appId) || appId < 1 || appId > 2147483647) throw new SteamPublicReviewError('invalid-input', 'appId must be a positive 32-bit integer')
  if (!FILTERS.has(filter)) throw new SteamPublicReviewError('invalid-input', `unsupported filter: ${filter}`)
  if (typeof language !== 'string' || !/^(?:all|[a-z][a-z_]{1,31})$/.test(language)) throw new SteamPublicReviewError('invalid-input', 'language must be all or a lowercase Steam API language code')
  if (!REVIEW_TYPES.has(reviewType)) throw new SteamPublicReviewError('invalid-input', `unsupported reviewType: ${reviewType}`)
  if (!PURCHASE_TYPES.has(purchaseType)) throw new SteamPublicReviewError('invalid-input', `unsupported purchaseType: ${purchaseType}`)
  if (typeof cursor !== 'string' || cursor.length < 1 || cursor.length > 1024 || /[\r\n]/.test(cursor)) throw new SteamPublicReviewError('invalid-input', 'cursor must be a non-empty single-line string up to 1024 characters')
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 20) throw new SteamPublicReviewError('invalid-input', 'perPage must be an integer between 1 and 20')
  if (typeof includeOfftopic !== 'boolean') throw new SteamPublicReviewError('invalid-input', 'includeOfftopic must be boolean')
  return { appId, filter, language, reviewType, purchaseType, cursor, perPage, includeOfftopic }
}

function unixSecondsToIso(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new SteamPublicReviewError('response-shape-changed', `${field} is invalid`)
  return new Date(value * 1000).toISOString()
}

function normalizeSummary(summary, returnedCount) {
  if (summary === undefined) return null
  const valid = summary && Number.isInteger(summary.num_reviews) && Number.isInteger(summary.review_score)
    && typeof summary.review_score_desc === 'string' && Number.isInteger(summary.total_positive)
    && Number.isInteger(summary.total_negative) && Number.isInteger(summary.total_reviews)
  if (!valid) throw new SteamPublicReviewError('response-shape-changed', 'query_summary shape changed')
  return {
    returnedCount: summary.num_reviews,
    reviewScore: summary.review_score,
    reviewScoreDescription: summary.review_score_desc,
    totalPositive: summary.total_positive,
    totalNegative: summary.total_negative,
    totalReviews: summary.total_reviews,
    _returnedCountMatches: summary.num_reviews === returnedCount,
  }
}

function normalizeReview(review) {
  const valid = review && typeof review.recommendationid === 'string' && /^[1-9][0-9]*$/.test(review.recommendationid)
    && typeof review.language === 'string' && typeof review.review === 'string'
    && typeof review.voted_up === 'boolean' && typeof review.steam_purchase === 'boolean'
    && typeof review.received_for_free === 'boolean' && typeof review.written_during_early_access === 'boolean'
    && review.author && typeof review.author === 'object'
  if (!valid) throw new SteamPublicReviewError('response-shape-changed', 'review item shape changed')
  const fullText = review.review
  const value = fullText.slice(0, MAX_REVIEW_TEXT_LENGTH)
  const playtimeAtReview = review.author.playtime_at_review
  if (playtimeAtReview !== undefined && (!Number.isInteger(playtimeAtReview) || playtimeAtReview < 0)) throw new SteamPublicReviewError('response-shape-changed', 'author.playtime_at_review is invalid')
  return {
    recommendationId: review.recommendationid,
    language: review.language,
    text: {
      retained: true,
      value,
      length: fullText.length,
      sha256: sha256(fullText),
      truncated: value.length !== fullText.length,
    },
    createdAt: unixSecondsToIso(review.timestamp_created, 'timestamp_created'),
    updatedAt: unixSecondsToIso(review.timestamp_updated, 'timestamp_updated'),
    recommended: review.voted_up,
    playtimeAtReviewMinutes: playtimeAtReview ?? null,
    steamPurchase: review.steam_purchase,
    receivedForFree: review.received_for_free,
    writtenDuringEarlyAccess: review.written_during_early_access,
    primarilySteamDeck: review.primarily_steam_deck === true,
  }
}

export function normalizeReviewResponse(payload, { input, observedAt = new Date().toISOString() }) {
  const query = normalizeInput(input)
  if (!payload || payload.success !== 1 || !Array.isArray(payload.reviews) || typeof payload.cursor !== 'string' || payload.cursor.length < 1 || payload.cursor.length > 1024) {
    throw new SteamPublicReviewError('response-shape-changed', 'Steam review response shape changed')
  }
  if (payload.reviews.length > query.perPage) throw new SteamPublicReviewError('response-shape-changed', 'Steam returned more reviews than requested')
  const reviews = payload.reviews.map(normalizeReview)
  const normalizedSummary = normalizeSummary(payload.query_summary, reviews.length)
  const summaryCountMatches = normalizedSummary?._returnedCountMatches ?? true
  if (normalizedSummary) delete normalizedSummary._returnedCountMatches
  const assertions = [
    { id: 'response-shape', passed: true },
    { id: 'page-bound', passed: reviews.length <= query.perPage },
    { id: 'summary-count', passed: summaryCountMatches },
    { id: 'author-identity-removed', passed: reviews.every((review) => !Object.hasOwn(review, 'author') && !JSON.stringify(review).includes('steamid')) },
    { id: 'cursor-present', passed: payload.cursor.length > 0 },
  ]
  const projection = {
    source: {
      id: 'steam-public-game-reviews',
      endpoint: `${API_BASE_URL}/appreviews/${query.appId}`,
      documentation: DOCUMENTATION_URL,
    },
    query,
    coverage: {
      representation: 'cursor-page',
      returnedCount: reviews.length,
      nextCursor: payload.cursor,
      pageExhausted: reviews.length === 0,
      corpusComplete: false,
      offtopicIncluded: query.includeOfftopic,
      authorIdentityRetained: false,
      reviewTextRetention: 'transient',
    },
    summary: normalizedSummary,
    reviews,
    observedAt,
  }
  return {
    ...projection,
    resultDigest: sha256(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

async function readJsonWithLimit(response, maxResponseBytes) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new SteamPublicReviewError('response-too-large', `Steam response exceeds ${maxResponseBytes} bytes`)
  if (!response.body) throw new SteamPublicReviewError('response-shape-changed', 'Steam response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxResponseBytes) {
      await reader.cancel()
      throw new SteamPublicReviewError('response-too-large', `Steam response exceeds ${maxResponseBytes} bytes`)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    throw new SteamPublicReviewError('response-shape-changed', 'Steam response is not valid JSON')
  }
}

export async function readPublicGameReviewPage(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  maxResponseBytes = 1_048_576,
  userAgent = 'dsh-knowledge-catalog/0.1',
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  const url = new URL(`/appreviews/${query.appId}`, API_BASE_URL)
  url.searchParams.set('json', '1')
  url.searchParams.set('filter', query.filter)
  url.searchParams.set('language', query.language)
  url.searchParams.set('review_type', query.reviewType)
  url.searchParams.set('purchase_type', query.purchaseType)
  url.searchParams.set('cursor', query.cursor)
  url.searchParams.set('num_per_page', String(query.perPage))
  url.searchParams.set('filter_offtopic_activity', query.includeOfftopic ? '0' : '1')
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': userAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new SteamPublicReviewError('http-error', `Steam review request failed: HTTP_${response.status}`, { status: response.status })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new SteamPublicReviewError('response-shape-changed', `Steam review response returned ${contentType || 'no content type'}`)
  return normalizeReviewResponse(await readJsonWithLimit(response, maxResponseBytes), { input: query, observedAt: now().toISOString() })
}

export function redactReviewTextForVerification(result) {
  return {
    ...result,
    coverage: { ...result.coverage, reviewTextRetention: 'redacted' },
    reviews: result.reviews.map((review) => ({
      ...review,
      text: { retained: false, length: review.text.length, sha256: review.text.sha256, truncated: review.text.truncated },
    })),
  }
}

export function projectReviewPageToFeedbackObservationWindow(page) {
  if (!page || typeof page !== 'object' || Array.isArray(page)) throw new SteamPublicReviewError('invalid-input', 'page must be a Steam public game review page')
  const valid = page.source?.id === 'steam-public-game-reviews'
    && Number.isInteger(page.query?.appId)
    && typeof page.query?.cursor === 'string'
    && page.coverage?.representation === 'cursor-page'
    && page.coverage?.corpusComplete === false
    && page.coverage?.authorIdentityRetained === false
    && typeof page.coverage?.nextCursor === 'string'
    && Array.isArray(page.reviews)
    && page.coverage.returnedCount === page.reviews.length
    && typeof page.observedAt === 'string'
    && Number.isFinite(Date.parse(page.observedAt))
    && page.conformance?.status === 'passed'
  if (!valid) throw new SteamPublicReviewError('invalid-input', 'page does not satisfy the verified Steam review-page contract')

  const items = page.reviews.map((review, index) => {
    const validReview = review && typeof review.recommendationId === 'string'
      && /^[1-9][0-9]*$/.test(review.recommendationId)
      && typeof review.text?.sha256 === 'string'
      && /^[a-f0-9]{64}$/.test(review.text.sha256)
      && typeof review.updatedAt === 'string'
      && Number.isFinite(Date.parse(review.updatedAt))
    if (!validReview) throw new SteamPublicReviewError('invalid-input', `page.reviews[${index}] cannot be projected`)
    const semantics = {
      textSha256: review.text.sha256,
      textLength: review.text.length,
      textTruncated: review.text.truncated,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      language: review.language,
      recommended: review.recommended,
      playtimeAtReviewMinutes: review.playtimeAtReviewMinutes,
      steamPurchase: review.steamPurchase,
      receivedForFree: review.receivedForFree,
      writtenDuringEarlyAccess: review.writtenDuringEarlyAccess,
      primarilySteamDeck: review.primarilySteamDeck,
    }
    return {
      itemRef: `steam-review:${review.recommendationId}`,
      contentDigest: `sha256:${sha256(stableStringify(semantics))}`,
      lifecycle: 'visible',
      replyState: 'unknown',
    }
  }).sort((left, right) => left.itemRef.localeCompare(right.itemRef))
  if (new Set(items.map((item) => item.itemRef)).size !== items.length) throw new SteamPublicReviewError('invalid-input', 'page contains duplicate recommendation IDs')

  const checkpointRef = `steam-review-cursor:sha256:${sha256(stableStringify({ appId: page.query.appId, query: page.query, nextCursor: page.coverage.nextCursor }))}`
  const payload = {
    schemaVersion: 'dsh.steam-feedback-observation-window/v1',
    sourceRef: 'steam:public-game-reviews',
    targetRef: `steam:app:${page.query.appId}`,
    window: {
      observedAt: new Date(page.observedAt).toISOString(),
      completeness: 'partial',
      checkpointRef,
      items,
    },
    coverage: {
      representation: 'cursor-page',
      returnedCount: items.length,
      currentCursor: page.query.cursor,
      resumeCursor: page.coverage.nextCursor,
      pageExhausted: page.coverage.pageExhausted,
      corpusComplete: false,
      itemIdentity: 'recommendation-id',
      editDetection: 'semantic-digest',
      explicitLifecycleTombstones: false,
      absenceDeletionInferenceAllowed: false,
      checkpointSemantics: 'resume-cursor-only-not-global-high-watermark',
    },
    checkpointRecommendation: { action: 'hold', reason: 'cursor-page-is-not-complete-window' },
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: sha256(stableStringify(payload)) }
}

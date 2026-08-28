import { createHash } from 'node:crypto'

export const YOUTUBE_API_ORIGIN = 'https://www.googleapis.com'
export const SEARCH_ENDPOINT = `${YOUTUBE_API_ORIGIN}/youtube/v3/search`
export const MAX_RESPONSE_BYTES = 256 * 1024
const ALLOWED_INPUT_KEYS = new Set(['query', 'publishedAfter', 'regionCode', 'relevanceLanguage', 'order', 'limit'])
const digest = (value) => createHash('sha256').update(value).digest('hex')

export class YouTubePublicVideoSearchError extends Error {
  constructor(message, { code, httpStatus = null } = {}) { super(message); this.name = 'YouTubePublicVideoSearchError'; this.code = code; this.httpStatus = httpStatus }
}

function boundedText(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`YouTube ${field} shape changed`)
  return value
}

function assertInput(input, maxResults = 10) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  const query = boundedText(input.query, 'query', 120).trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.publishedAfter) || !Number.isFinite(Date.parse(input.publishedAfter))) throw new Error('publishedAfter must be an RFC 3339 UTC date-time')
  if (!/^[A-Z]{2}$/.test(input.regionCode)) throw new Error('regionCode must be two uppercase ISO 3166-1 letters')
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.relevanceLanguage)) throw new Error('relevanceLanguage must be a bounded language hint')
  if (!['date', 'relevance'].includes(input.order)) throw new Error('order must be date or relevance')
  const limit = input.limit ?? maxResults
  if (!Number.isInteger(limit) || limit < 1 || limit > Math.min(10, maxResults)) throw new Error('limit exceeds the configured one-page bound')
  return { query, publishedAfter: input.publishedAfter, regionCode: input.regionCode, relevanceLanguage: input.relevanceLanguage, order: input.order, limit }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`YouTube search returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('YouTube search response exceeds the 256 KiB budget')
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error('YouTube search response exceeds the 256 KiB budget')
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) } catch { throw new Error('YouTube search response is not valid JSON') }
}

export function normalizeSearchResponse(payload, { input, observedAt = new Date().toISOString(), maxResults = 10 } = {}) {
  const request = assertInput(input, maxResults)
  if (!payload || typeof payload !== 'object' || payload.kind !== 'youtube#searchListResponse' || !Array.isArray(payload.items) || payload.items.length > request.limit) throw new Error('YouTube search response envelope changed')
  if (typeof payload.regionCode !== 'string' || !/^[A-Z]{2}$/.test(payload.regionCode)) throw new Error('YouTube selected region shape changed')
  const seen = new Set()
  const items = payload.items.map((item) => {
    const videoId = item?.id?.videoId
    if (item?.id?.kind !== 'youtube#video' || typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || seen.has(videoId)) throw new Error('YouTube video identity shape changed')
    seen.add(videoId)
    const publishedAt = item?.snippet?.publishedAt
    if (typeof publishedAt !== 'string' || !Number.isFinite(Date.parse(publishedAt)) || Date.parse(publishedAt) < Date.parse(request.publishedAfter)) throw new Error('YouTube publishedAt escaped the request window')
    return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`, title: boundedText(item.snippet.title, 'title', 1000), publishedAt }
  })
  const projection = {
    source: { id: 'youtube-public-video-search', apiOrigin: YOUTUBE_API_ORIGIN, accessClass: 'official-api-key' },
    request,
    selectedRegionCode: payload.regionCode,
    items,
    coverage: { pageCount: 1, returnedItems: items.length, corpusComplete: false, paginationFollowed: false, resultCountSemantics: 'returned-page-size-only', metadataOnly: true },
    retention: { nonAuthorizedApiDataMaximumDays: 30 },
    quota: { searchBucketUnitsExpected: 1, requestsMade: 1 },
  }
  const serialized = JSON.stringify(projection)
  const assertions = [
    { id: 'bounded-single-page', passed: items.length <= request.limit && request.limit <= 10 },
    { id: 'identity-and-content-minimized', passed: !/\"(?:channel(?:Id|Title)?|author|description|thumbnail|statistics|metrics|transcript|nextPageToken|totalResults|apiKey|raw)\"/i.test(serialized) },
    { id: 'coverage-qualified', passed: projection.coverage.corpusComplete === false && projection.coverage.paginationFollowed === false },
  ]
  return { ...projection, observedAt, resultDigest: digest(JSON.stringify(projection)), conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } }
}

export async function searchPublicVideos(input, { apiKey, fetchImpl = fetch, timeoutMs = 15000, maxResults = 10, now = () => new Date() } = {}) {
  const request = assertInput(input, maxResults)
  if (typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 256 || /[\s\r\n]/.test(apiKey)) throw new Error('apiKey must be supplied through the youtube-api-key credential slot')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const url = new URL('/youtube/v3/search', YOUTUBE_API_ORIGIN)
  for (const [key, value] of Object.entries({ part: 'snippet', type: 'video', q: request.query, publishedAfter: request.publishedAfter, regionCode: request.regionCode, relevanceLanguage: request.relevanceLanguage, order: request.order, maxResults: String(request.limit), safeSearch: 'moderate', fields: 'kind,regionCode,pageInfo(resultsPerPage),items(id(kind,videoId),snippet(publishedAt,title))', key: apiKey })) url.searchParams.set(key, value)
  const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new YouTubePublicVideoSearchError(`YouTube search failed: HTTP_${response.status}`, { code: response.status === 403 ? 'quota-or-access-blocked' : response.status === 429 ? 'rate-limited' : `http-${response.status}`, httpStatus: response.status })
  return normalizeSearchResponse(await readJsonResponse(response), { input: request, observedAt: now().toISOString(), maxResults })
}

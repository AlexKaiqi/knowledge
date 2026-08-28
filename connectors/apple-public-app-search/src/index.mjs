import { createHash } from 'node:crypto'

export const API_ENDPOINT = 'https://itunes.apple.com/search'
export const DOCUMENTATION_URL = 'https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html'
export const SEARCH_CONTRACT_URL = 'https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html'

const ALLOWED_INPUT_KEYS = new Set(['query', 'country', 'surface', 'limit'])
const SURFACES = new Map([['iphone', 'software'], ['ipad', 'iPadSoftware'], ['mac', 'macSoftware']])
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

let requestTail = Promise.resolve()
let nextRequestAt = 0

export class ApplePublicAppSearchError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ApplePublicAppSearchError'
    this.code = code
    this.details = details
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

function boundedText(value, field, maximum) {
  if (typeof value !== 'string') throw new ApplePublicAppSearchError('response-shape-changed', `${field} is not text`)
  const normalized = value.replace(/\s+/g, ' ').normalize('NFC').trim()
  if (normalized.length < 1 || normalized.length > maximum) throw new ApplePublicAppSearchError('response-shape-changed', `${field} is outside its bound`)
  return normalized
}

function iso(value, field) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new ApplePublicAppSearchError('response-shape-changed', `${field} is not a timestamp`)
  return new Date(timestamp).toISOString()
}

function safeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new ApplePublicAppSearchError('response-shape-changed', `${field} is not a non-negative safe integer`)
  return value
}

function finiteNumber(value, field, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new ApplePublicAppSearchError('response-shape-changed', `${field} is outside its bound`)
  return value
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApplePublicAppSearchError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new ApplePublicAppSearchError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.query !== 'string') throw new ApplePublicAppSearchError('invalid-input', 'query must be text')
  const query = input.query.replace(/\s+/g, ' ').normalize('NFC').trim()
  if (query.length < 2 || query.length > 100 || /[\0\r\n*]/.test(query)) throw new ApplePublicAppSearchError('invalid-input', 'query must be a plain bounded phrase')
  if (typeof input.country !== 'string' || !/^[A-Za-z]{2}$/.test(input.country)) throw new ApplePublicAppSearchError('invalid-input', 'country must be an ISO alpha-2 code')
  const country = input.country.toUpperCase()
  const surface = input.surface ?? 'iphone'
  if (!SURFACES.has(surface)) throw new ApplePublicAppSearchError('invalid-input', `unsupported surface: ${surface}`)
  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new ApplePublicAppSearchError('invalid-input', 'limit must be between 1 and 25')
  return { query, country, surface, limit }
}

export function buildRequestUrl(input) {
  const query = normalizeInput(input)
  const url = new URL(API_ENDPOINT)
  url.searchParams.set('term', query.query)
  url.searchParams.set('country', query.country.toLowerCase())
  url.searchParams.set('media', 'software')
  url.searchParams.set('entity', SURFACES.get(query.surface))
  url.searchParams.set('limit', String(query.limit))
  url.searchParams.set('explicit', 'No')
  url.searchParams.set('version', '2')
  return url
}

function canonicalStoreUrl(appId, country) {
  return `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`
}

function normalizeItem(item, country) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApplePublicAppSearchError('response-shape-changed', 'result item is invalid')
  if (item.wrapperType !== 'software' || item.kind !== 'software') throw new ApplePublicAppSearchError('response-identity-drift', 'result item is not software')
  const appId = safeInteger(item.trackId, 'trackId')
  if (appId < 1) throw new ApplePublicAppSearchError('response-shape-changed', 'trackId must be positive')
  let sourceUrl
  try { sourceUrl = new URL(item.trackViewUrl) } catch { throw new ApplePublicAppSearchError('response-shape-changed', 'trackViewUrl is invalid') }
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'apps.apple.com' || !sourceUrl.pathname.includes(`/id${appId}`)) throw new ApplePublicAppSearchError('response-identity-drift', 'trackViewUrl escaped the requested App Store item')
  const genres = [...new Set((Array.isArray(item.genres) ? item.genres : []).map((genre, index) => boundedText(genre, `genres[${index}]`, 100)))].sort()
  if (genres.length < 1 || genres.length > 20) throw new ApplePublicAppSearchError('response-shape-changed', 'genres are outside their bound')
  const ratingCount = safeInteger(item.userRatingCount ?? 0, 'userRatingCount')
  const average = finiteNumber(item.averageUserRating ?? 0, 'averageUserRating', 0, 5)
  const currency = boundedText(item.currency, 'currency', 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new ApplePublicAppSearchError('response-shape-changed', 'currency is invalid')
  return {
    appId: String(appId),
    name: boundedText(item.trackName, 'trackName', 300),
    bundleId: boundedText(item.bundleId, 'bundleId', 300),
    developer: boundedText(item.sellerName, 'sellerName', 500),
    primaryGenre: boundedText(item.primaryGenreName, 'primaryGenreName', 100),
    genres,
    version: boundedText(item.version, 'version', 100),
    releasedAt: iso(item.releaseDate, 'releaseDate'),
    currentVersionReleasedAt: iso(item.currentVersionReleaseDate, 'currentVersionReleaseDate'),
    price: { amount: finiteNumber(item.price, 'price', 0, 1_000_000), currency },
    rating: { average: Math.round(average * 100000) / 100000, count: ratingCount },
    storeUrl: canonicalStoreUrl(appId, country),
  }
}

export function normalizeSearchResponse(payload, { input, observedAt = new Date().toISOString() } = {}) {
  const query = normalizeInput(input)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.results)) throw new ApplePublicAppSearchError('response-shape-changed', 'response must contain results')
  const resultCount = safeInteger(payload.resultCount, 'resultCount')
  if (resultCount !== payload.results.length || resultCount > query.limit) throw new ApplePublicAppSearchError('response-identity-drift', 'response count exceeds or does not match the requested page')
  const items = payload.results.map((item) => normalizeItem(item, query.country))
  if (new Set(items.map((item) => item.appId)).size !== items.length) throw new ApplePublicAppSearchError('response-shape-changed', 'duplicate App Store IDs returned')
  const projection = {
    source: {
      store: 'apple-app-store',
      accessSurface: 'itunes-search-api',
      contractStatus: 'official-documentation-archive',
      documentation: DOCUMENTATION_URL,
    },
    query,
    coverage: {
      representation: 'bounded-search-page',
      returnedCount: items.length,
      requestedLimit: query.limit,
      storefrontCountry: query.country,
      corpusComplete: false,
      resultSetMutable: true,
      historical: false,
      rankingSemantics: 'apple-search-api-unspecified',
      resultCountSemantics: 'returned-page-size-only',
      metadataOnly: true,
    },
    items,
    observedAt: iso(observedAt, 'observedAt'),
  }
  const assertions = [
    { id: 'page-bound', passed: items.length <= query.limit && query.limit <= 25 },
    { id: 'request-identity', passed: projection.coverage.storefrontCountry === query.country },
    { id: 'unique-app-ids', passed: new Set(items.map((item) => item.appId)).size === items.length },
    { id: 'official-store-links', passed: items.every((item) => item.storeUrl.startsWith(`https://apps.apple.com/${query.country.toLowerCase()}/app/id`)) },
    { id: 'ranking-unspecified', passed: projection.coverage.rankingSemantics === 'apple-search-api-unspecified' },
    { id: 'not-corpus-count', passed: projection.coverage.resultCountSemantics === 'returned-page-size-only' && !projection.coverage.corpusComplete },
    { id: 'metadata-only', passed: projection.coverage.metadataOnly },
  ]
  return { ...projection, resultDigest: sha256(stableStringify(projection)), conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions } }
}

async function readTextWithLimit(response, maximum) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new ApplePublicAppSearchError('response-too-large', `response exceeds ${maximum} bytes`)
  if (!response.body) throw new ApplePublicAppSearchError('response-shape-changed', 'response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximum) { await reader.cancel(); throw new ApplePublicAppSearchError('response-too-large', `response exceeds ${maximum} bytes`) }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

async function scheduleRequest(operation, { minimumIntervalMs, sleep, clock }) {
  const run = requestTail.then(async () => {
    const wait = Math.max(0, nextRequestAt - clock())
    if (wait > 0) await sleep(wait)
    nextRequestAt = clock() + minimumIntervalMs
    return operation()
  })
  requestTail = run.catch(() => {})
  return run
}

export async function searchPublicAppCatalog(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  maxResponseBytes = 524_288,
  minimumIntervalMs = 3_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  clock = () => Date.now(),
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < 3000 || minimumIntervalMs > 60000) throw new ApplePublicAppSearchError('configuration-error', 'minimumIntervalMs must respect the documented call limit')
  if (typeof userAgent !== 'string' || userAgent.length < 10 || userAgent.length > 256 || /[\r\n]/.test(userAgent)) throw new ApplePublicAppSearchError('configuration-error', 'userAgent must identify a bounded service')
  const url = buildRequestUrl(query)
  return scheduleRequest(async () => {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json, text/javascript;q=0.9', 'user-agent': userAgent },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const code = response.status === 429 ? 'rate-limited' : response.status >= 500 ? 'temporarily-unavailable' : 'http-error'
      throw new ApplePublicAppSearchError(code, `Apple search request failed: HTTP_${response.status}`, { status: response.status })
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!/(?:json|javascript)/i.test(contentType)) throw new ApplePublicAppSearchError('response-shape-changed', `Apple returned ${contentType || 'no content type'}`)
    const text = await readTextWithLimit(response, maxResponseBytes)
    let payload
    try { payload = JSON.parse(text) } catch { throw new ApplePublicAppSearchError('response-shape-changed', 'Apple response is not JSON') }
    return normalizeSearchResponse(payload, { input: query, observedAt: now().toISOString() })
  }, { minimumIntervalMs, sleep, clock })
}

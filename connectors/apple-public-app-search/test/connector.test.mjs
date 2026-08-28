import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ApplePublicAppSearchError,
  buildRequestUrl,
  normalizeInput,
  normalizeSearchResponse,
  searchPublicAppCatalog,
} from '../src/index.mjs'

const input = { query: 'personal assistant', country: 'US', surface: 'iphone', limit: 2 }
const item = (overrides = {}) => ({
  wrapperType: 'software',
  kind: 'software',
  trackId: 6448311069,
  trackName: 'ChatGPT',
  bundleId: 'com.openai.chat',
  sellerName: 'OpenAI OpCo, LLC',
  primaryGenreName: 'Productivity',
  genres: ['Productivity', 'Utilities'],
  version: '1.2026.230',
  releaseDate: '2023-05-18T00:00:00Z',
  currentVersionReleaseDate: '2026-08-26T22:31:34Z',
  price: 0,
  currency: 'USD',
  averageUserRating: 4.83014,
  userRatingCount: 9679535,
  trackViewUrl: 'https://apps.apple.com/us/app/chatgpt/id6448311069?uo=4',
  description: 'must not be retained',
  releaseNotes: 'must not be retained',
  artworkUrl100: 'https://example.invalid/icon.png',
  ...overrides,
})

const payload = (results = [item()]) => ({ resultCount: results.length, results })

test('normalizes a bounded metadata-only App Store search page', () => {
  const result = normalizeSearchResponse(payload(), { input, observedAt: '2026-08-27T05:20:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.items[0], {
    appId: '6448311069',
    name: 'ChatGPT',
    bundleId: 'com.openai.chat',
    developer: 'OpenAI OpCo, LLC',
    primaryGenre: 'Productivity',
    genres: ['Productivity', 'Utilities'],
    version: '1.2026.230',
    releasedAt: '2023-05-18T00:00:00.000Z',
    currentVersionReleasedAt: '2026-08-26T22:31:34.000Z',
    price: { amount: 0, currency: 'USD' },
    rating: { average: 4.83014, count: 9679535 },
    storeUrl: 'https://apps.apple.com/us/app/id6448311069',
  })
  assert.equal(JSON.stringify(result).includes('must not be retained'), false)
  assert.equal(result.coverage.rankingSemantics, 'apple-search-api-unspecified')
  assert.equal(result.coverage.resultCountSemantics, 'returned-page-size-only')
  assert.equal(result.coverage.corpusComplete, false)
})

test('accepts only a plain bounded query and fixed public parameters', () => {
  assert.deepEqual(normalizeInput({ query: 'AI 宠物', country: 'cn' }), { query: 'AI 宠物', country: 'CN', surface: 'iphone', limit: 10 })
  const url = buildRequestUrl({ query: 'AI 宠物', country: 'CN', surface: 'ipad', limit: 5 })
  assert.equal(url.origin + url.pathname, 'https://itunes.apple.com/search')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    term: 'AI 宠物', country: 'cn', media: 'software', entity: 'iPadSoftware', limit: '5', explicit: 'No', version: '2',
  })
  for (const invalid of [
    { ...input, endpoint: 'https://example.com' },
    { ...input, query: '*' },
    { ...input, country: 'USA' },
    { ...input, surface: 'all' },
    { ...input, limit: 200 },
  ]) assert.throws(() => normalizeInput(invalid), ApplePublicAppSearchError)
})

test('rejects count, identity, rating, link and duplicate drift', () => {
  const cases = [
    { resultCount: 2, results: [item()] },
    payload([item({ wrapperType: 'track' })]),
    payload([item({ averageUserRating: 6 })]),
    payload([item({ trackViewUrl: 'https://example.com/id6448311069' })]),
    payload([item(), item()]),
  ]
  for (const candidate of cases) assert.throws(() => normalizeSearchResponse(candidate, { input, observedAt: '2026-08-27T05:20:00Z' }), ApplePublicAppSearchError)
})

test('uses one fixed official request and never retries', async () => {
  let request
  let calls = 0
  const result = await searchPublicAppCatalog(input, {
    fetchImpl: async (url, options) => {
      calls += 1
      request = { url: String(url), options }
      return new Response(JSON.stringify(payload()), { status: 200, headers: { 'content-type': 'text/javascript; charset=utf-8' } })
    },
    sleep: async () => {},
    clock: () => Date.now() + 1_000_000_000_000,
    now: () => new Date('2026-08-27T05:20:00Z'),
  })
  assert.equal(calls, 1)
  assert.equal(new URL(request.url).hostname, 'itunes.apple.com')
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.redirect, 'error')
  assert.equal(result.conformance.status, 'passed')

  calls = 0
  await assert.rejects(() => searchPublicAppCatalog(input, {
    fetchImpl: async () => { calls += 1; return new Response('', { status: 503 }) },
    sleep: async () => {},
    clock: () => Date.now() + 2_000_000_000_000,
  }), (error) => error.code === 'temporarily-unavailable')
  assert.equal(calls, 1)
})

test('enforces content type and streaming response budget', async () => {
  const common = { sleep: async () => {}, clock: () => Date.now() + 3_000_000_000_000 }
  await assert.rejects(() => searchPublicAppCatalog(input, {
    ...common,
    fetchImpl: async () => new Response(JSON.stringify(payload()), { headers: { 'content-type': 'text/html' } }),
  }), (error) => error.code === 'response-shape-changed')
  await assert.rejects(() => searchPublicAppCatalog(input, {
    ...common,
    maxResponseBytes: 128,
    fetchImpl: async () => new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json' } }),
  }), (error) => error.code === 'response-too-large')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSearchResponse, searchPublicVideos } from '../src/index.mjs'

const input = { query: 'personal ai assistant', publishedAfter: '2026-08-01T00:00:00Z', regionCode: 'US', relevanceLanguage: 'en', order: 'relevance', limit: 2 }
const payload = { kind: 'youtube#searchListResponse', nextPageToken: 'excluded', regionCode: 'US', pageInfo: { totalResults: 999999, resultsPerPage: 2 }, items: [
  { id: { kind: 'youtube#video', videoId: 'abcdefghijk' }, snippet: { publishedAt: '2026-08-20T00:00:00Z', channelId: 'excluded', channelTitle: 'excluded', title: 'Personal AI assistant', description: 'excluded', thumbnails: { default: {} } } },
] }

test('normalizes one metadata-only page without channel identity or corpus claims', () => {
  const result = normalizeSearchResponse(payload, { input, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.items, [{ videoId: 'abcdefghijk', canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'Personal AI assistant', publishedAt: '2026-08-20T00:00:00Z' }])
  assert.equal(result.coverage.corpusComplete, false)
  for (const value of ['channelId', 'channelTitle', 'description', 'nextPageToken', 'totalResults']) assert.equal(JSON.stringify(result).includes(value), false)
})

test('builds one fixed official request and never exposes the API key', async () => {
  let observed
  const apiKey = 'secret-api-key-12345'
  const result = await searchPublicVideos(input, { apiKey, fetchImpl: async (url, options) => { observed = { url, options }; return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }) } })
  assert.equal(observed.url.origin, 'https://www.googleapis.com')
  assert.equal(observed.url.pathname, '/youtube/v3/search')
  assert.equal(observed.url.searchParams.get('type'), 'video')
  assert.equal(observed.options.redirect, 'error')
  assert.equal(JSON.stringify(result).includes(apiKey), false)
})

test('rejects unbounded queries, paging controls, stale-window escapes, and duplicate identities', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => searchPublicVideos({ ...input, pageToken: 'x' }, { apiKey: 'secret-api-key-12345', fetchImpl }), /unknown input fields/)
  await assert.rejects(() => searchPublicVideos({ ...input, limit: 11 }, { apiKey: 'secret-api-key-12345', fetchImpl }), /one-page bound/)
  assert.throws(() => normalizeSearchResponse({ ...payload, items: [{ ...payload.items[0], snippet: { ...payload.items[0].snippet, publishedAt: '2026-07-01T00:00:00Z' } }] }, { input }), /escaped the request window/)
  assert.throws(() => normalizeSearchResponse({ ...payload, items: [payload.items[0], payload.items[0]] }, { input }), /identity shape/)
  assert.equal(calls, 0)
})

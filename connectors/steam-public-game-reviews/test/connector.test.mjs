import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeReviewResponse, projectReviewPageToFeedbackObservationWindow, readPublicGameReviewPage, redactReviewTextForVerification, SteamPublicReviewError } from '../src/index.mjs'

const input = { appId: 620, filter: 'updated', language: 'english', reviewType: 'all', purchaseType: 'all', cursor: '*', perPage: 2, includeOfftopic: false }
const payload = {
  success: 1,
  query_summary: { num_reviews: 2, review_score: 9, review_score_desc: 'Overwhelmingly Positive', total_positive: 100, total_negative: 2, total_reviews: 102 },
  cursor: 'next+cursor=',
  reviews: [
    {
      recommendationid: '123',
      author: { steamid: 'private-from-output', personaname: 'private-from-output', playtime_at_review: 120 },
      language: 'english',
      review: 'The portal mechanics remain clear.',
      timestamp_created: 1700000000,
      timestamp_updated: 1700000100,
      voted_up: true,
      steam_purchase: true,
      received_for_free: false,
      written_during_early_access: false,
      primarily_steam_deck: false,
    },
    {
      recommendationid: '124',
      author: { steamid: 'also-private', playtime_at_review: 30 },
      language: 'english',
      review: 'Co-op onboarding was confusing.',
      timestamp_created: 1700000200,
      timestamp_updated: 1700000200,
      voted_up: false,
      steam_purchase: false,
      received_for_free: true,
      written_during_early_access: false,
    },
  ],
}

test('normalizes a bounded review page and removes author identity', () => {
  const result = normalizeReviewResponse(payload, { input, observedAt: '2026-08-27T01:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.reviews.length, 2)
  assert.equal(result.reviews[0].playtimeAtReviewMinutes, 120)
  assert.equal(JSON.stringify(result).includes('private-from-output'), false)
  assert.equal(result.coverage.corpusComplete, false)
  assert.equal(result.summary.totalReviews, 102)
})

test('verification redaction retains evidence identity without review text', () => {
  const result = redactReviewTextForVerification(normalizeReviewResponse(payload, { input, observedAt: '2026-08-27T01:00:00Z' }))
  assert.equal(result.coverage.reviewTextRetention, 'redacted')
  assert.equal(result.reviews[0].text.retained, false)
  assert.equal(Object.hasOwn(result.reviews[0].text, 'value'), false)
  assert.match(result.reviews[0].text.sha256, /^[a-f0-9]{64}$/)
})

test('rejects unsupported ranking, injection, oversized pages and malformed responses', () => {
  assert.throws(() => normalizeReviewResponse(payload, { input: { ...input, filter: 'all' } }), SteamPublicReviewError)
  assert.throws(() => normalizeReviewResponse(payload, { input: { ...input, cursor: '*\nnext' } }), SteamPublicReviewError)
  assert.throws(() => normalizeReviewResponse(payload, { input: { ...input, perPage: 21 } }), SteamPublicReviewError)
  assert.throws(() => normalizeReviewResponse({ ...payload, success: 0 }, { input }), /response shape changed/)
  assert.equal(normalizeReviewResponse({ ...payload, reviews: payload.reviews.slice(0, 1) }, { input }).conformance.status, 'review-required')
})

test('uses one fixed public endpoint, encodes cursor, and never retries', async () => {
  const calls = []
  const result = await readPublicGameReviewPage(input, {
    now: () => new Date('2026-08-27T01:00:00Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].url)
  assert.equal(url.origin, 'https://store.steampowered.com')
  assert.equal(url.pathname, '/appreviews/620')
  assert.equal(url.searchParams.get('cursor'), '*')
  assert.equal(url.searchParams.get('filter_offtopic_activity'), '1')
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(result.conformance.status, 'passed')

  let failures = 0
  await assert.rejects(() => readPublicGameReviewPage(input, {
    fetchImpl: async () => {
      failures += 1
      return new Response('busy', { status: 429, headers: { 'content-type': 'text/plain' } })
    },
  }), /HTTP_429/)
  assert.equal(failures, 1)
})

test('enforces the streaming response budget', async () => {
  await assert.rejects(() => readPublicGameReviewPage(input, {
    maxResponseBytes: 128,
    fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }),
  }), /exceeds 128 bytes/)
})

test('projects a cursor page into a partial feedback window without inferring deletion', () => {
  const page = redactReviewTextForVerification(normalizeReviewResponse(payload, { input, observedAt: '2026-08-27T01:00:00Z' }))
  const result = projectReviewPageToFeedbackObservationWindow(page)
  assert.equal(result.window.completeness, 'partial')
  assert.equal(result.coverage.checkpointSemantics, 'resume-cursor-only-not-global-high-watermark')
  assert.equal(result.coverage.absenceDeletionInferenceAllowed, false)
  assert.equal(result.coverage.explicitLifecycleTombstones, false)
  assert.equal(result.checkpointRecommendation.action, 'hold')
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.window.items.every((item) => item.lifecycle === 'visible' && item.replyState === 'unknown'), true)
  assert.equal(JSON.stringify(result).includes('portal mechanics'), false)
  const reordered = { ...page, reviews: [...page.reviews].reverse() }
  assert.equal(projectReviewPageToFeedbackObservationWindow(reordered).resultDigest, result.resultDigest)
})

test('semantic feedback digest changes when an observed Steam review changes', () => {
  const page = redactReviewTextForVerification(normalizeReviewResponse(payload, { input, observedAt: '2026-08-27T01:00:00Z' }))
  const before = projectReviewPageToFeedbackObservationWindow(page)
  const changed = structuredClone(page)
  changed.reviews[0].text.sha256 = 'a'.repeat(64)
  changed.reviews[0].updatedAt = '2026-08-27T02:00:00.000Z'
  const after = projectReviewPageToFeedbackObservationWindow(changed)
  const ref = 'steam-review:123'
  assert.notEqual(before.window.items.find((item) => item.itemRef === ref).contentDigest, after.window.items.find((item) => item.itemRef === ref).contentDigest)
})

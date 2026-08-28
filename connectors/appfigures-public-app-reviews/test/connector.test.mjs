import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_BASE_URL,
  normalizeInput,
  normalizeReviewSnapshot,
  PublicAppReviewError,
  readPublicAppReviewSnapshot,
  redactReviewTextForVerification,
} from '../src/index.mjs'

const input = { store: 'apple', appId: '6448311069', country: 'US', startDate: '2026-07-29', endDate: '2026-08-27', stars: [1, 2], query: 'memory', limit: 2 }
const productPayload = { id: 987654, name: 'Assistant App', developer: 'Example Developer', vendor_identifier: input.appId, ref_no: Number(input.appId), store: 'apple' }
const reviewsPayload = {
  total: 20,
  pages: 10,
  this_page: 1,
  reviews: [
    { id: 'provider-review-1', author: 'must-disappear', title: 'Memory issue', review: 'It forgot my earlier preference.', original_title: null, original_review: null, stars: '1.00', iso: 'US', version: '1.2', date: '2026-08-26T10:00:00', product: 987654, has_response: false, predicted_langs: ['en'] },
    { id: 'provider-review-2', author: null, title: 'Better now', review: 'The latest version improved reminders.', original_title: null, original_review: null, stars: '2.00', iso: 'US', version: null, date: '2026-08-25T10:00:00', product: 987654, has_response: true },
  ],
}

test('normalizes a bounded competitor review snapshot and removes route-specific identity', () => {
  const result = normalizeReviewSnapshot({ productPayload, reviewsPayload }, { input, now: () => new Date('2026-08-27T04:00:00Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.reviews.length, 2)
  assert.equal(result.reviews[0].rating, 1)
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.authorIdentityRetained, false)
  assert.equal(result.coverage.developerResponseStatus, 'unavailable-for-public-competitor')
  assert.equal(result.billing.expectedMaximumCredits, 5)
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('must-disappear'), false)
  assert.equal(serialized.includes('provider-review-1'), false)
  assert.equal(serialized.includes('987654'), false)
  assert.equal(serialized.includes('appfigures'), false)
  assert.equal(serialized.includes('has_response'), false)
})

test('separates Apple territory from Google Play country-unavailable semantics', () => {
  assert.throws(() => normalizeInput({ ...input, store: 'google_play', appId: 'com.openai.chatgpt' }), /do not support country/)
  assert.throws(() => normalizeInput({ ...input, country: undefined }), /country/)
  const googleInput = { store: 'google_play', appId: 'com.openai.chatgpt', startDate: '2026-07-29', endDate: '2026-08-27', limit: 1 }
  const googleProduct = { id: 123, name: 'Assistant', developer: 'Example', package_name: googleInput.appId, store: 'google_play' }
  const googleReviews = { total: 1, pages: 1, this_page: 1, reviews: [{ ...reviewsPayload.reviews[0], id: 'google-review', product: 123, iso: 'ZZ' }] }
  const result = normalizeReviewSnapshot({ productPayload: googleProduct, reviewsPayload: googleReviews }, { input: googleInput })
  assert.equal(result.reviews[0].regionSemantics, 'country-unavailable')
})

test('rejects internal IDs, long windows, unsafe fields and oversized pages', () => {
  assert.throws(() => normalizeInput({ ...input, productId: 987654 }), /unknown input fields/)
  assert.throws(() => normalizeInput({ ...input, appId: '../987654' }), /numeric store ID/)
  assert.throws(() => normalizeInput({ ...input, startDate: '2025-01-01' }), /between 1 and 90 days/)
  assert.throws(() => normalizeInput({ ...input, query: 'memory\nauthor' }), /single-line/)
  assert.throws(() => normalizeInput({ ...input, limit: 26 }), /between 1 and 25/)
})

test('uses exactly product resolution then one fixed newest-first reviews request', async () => {
  const calls = []
  const result = await readPublicAppReviewSnapshot(input, {
    credentials: { token: 'pat_secret_not_returned' },
    now: () => new Date('2026-08-27T04:00:00Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      const payload = calls.length === 1 ? productPayload : reviewsPayload
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, `${API_BASE_URL}/products/apple/6448311069`)
  const reviewUrl = new URL(calls[1].url)
  assert.equal(reviewUrl.origin + reviewUrl.pathname, `${API_BASE_URL}/reviews`)
  assert.equal(reviewUrl.searchParams.get('products'), '987654')
  assert.equal(reviewUrl.searchParams.get('page'), '1')
  assert.equal(reviewUrl.searchParams.get('count'), '2')
  assert.equal(reviewUrl.searchParams.get('sort'), '-date')
  assert.equal(reviewUrl.searchParams.get('countries'), 'US')
  assert.equal(reviewUrl.searchParams.get('lang'), null)
  assert.equal(calls.every((call) => call.options.headers.authorization === 'Bearer pat_secret_not_returned' && call.options.redirect === 'error'), true)
  assert.equal(JSON.stringify(result).includes('pat_secret_not_returned'), false)
})

test('does not poll pending products or retry access and rate failures', async () => {
  let attempts = 0
  await assert.rejects(() => readPublicAppReviewSnapshot(input, {
    credentials: { token: 'pat_secret' },
    fetchImpl: async () => {
      attempts += 1
      return new Response('{}', { status: 202, headers: { 'content-type': 'application/json' } })
    },
  }), (error) => error instanceof PublicAppReviewError && error.code === 'product-resolution-pending')
  assert.equal(attempts, 1)

  attempts = 0
  await assert.rejects(() => readPublicAppReviewSnapshot(input, {
    credentials: { token: 'pat_secret' },
    fetchImpl: async () => {
      attempts += 1
      if (attempts === 1) return new Response(JSON.stringify(productPayload), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response('{}', { status: 429, headers: { 'content-type': 'application/json' } })
    },
  }), (error) => error.code === 'rate-limited')
  assert.equal(attempts, 2)
})

test('verification redaction and response bounds preserve evidence without review text', async () => {
  const redacted = redactReviewTextForVerification(normalizeReviewSnapshot({ productPayload, reviewsPayload }, { input }))
  assert.equal(redacted.coverage.reviewTextRetention, 'redacted')
  assert.equal(redacted.reviews.every((review) => !Object.hasOwn(review.title, 'value') && !Object.hasOwn(review.body, 'value')), true)
  assert.match(redacted.reviews[0].body.sha256, /^[a-f0-9]{64}$/)

  await assert.rejects(() => readPublicAppReviewSnapshot(input, {
    credentials: { token: 'pat_secret' },
    maxResponseBytes: 128,
    fetchImpl: async () => new Response(JSON.stringify(productPayload), { status: 200, headers: { 'content-type': 'application/json' } }),
  }), /exceeds 128 bytes/)
})

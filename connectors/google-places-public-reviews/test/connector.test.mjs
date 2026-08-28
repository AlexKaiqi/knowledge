import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAXIMUM_COST_USD,
  PLACE_DETAILS_FIELD_MASK,
  PublicPlaceReviewError,
  TEXT_SEARCH_FIELD_MASK,
  normalizeInput,
  normalizeObservation,
  readPublicPlaceReviewSnapshot,
  redactForVerification,
} from '../src/index.mjs'

const input = {
  query: 'Googleplex Mountain View',
  locationBias: { latitude: 37.422, longitude: -122.084, radiusMeters: 5000 },
  languageCode: 'en',
  regionCode: 'US',
  limit: 2,
  usageMode: 'ephemeral-attributed-research',
  acknowledgeAttributionDisplay: true,
  acknowledgeNoDurableRetention: true,
}

const placeId = 'ChIJj61dQgK6j4AR4GeTYWZsKWw'
const searchPayload = { places: [{ id: placeId }] }
const detailsPayload = {
  id: placeId,
  displayName: { text: 'Googleplex', languageCode: 'en' },
  formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA',
  types: ['point_of_interest', 'establishment'],
  googleMapsUri: 'https://www.google.com/maps/place/?q=place_id:test',
  rating: 4.5,
  userRatingCount: 1000,
  attributions: [{ provider: 'Example provider', providerUri: 'https://www.google.com/' }],
  reviews: [
    {
      name: `places/${placeId}/reviews/review-one`,
      relativePublishTimeDescription: 'a month ago',
      text: { text: 'Useful local experience detail.', languageCode: 'en' },
      originalText: { text: 'Useful local experience detail.', languageCode: 'en' },
      rating: 4,
      authorAttribution: { displayName: 'Required author', uri: 'https://www.google.com/maps/contrib/100/reviews', photoUri: 'https://lh3.googleusercontent.com/a/example' },
      publishTime: '2026-07-20T10:00:00Z',
      flagContentUri: 'https://www.google.com/local/review/rap/report?postId=one',
      googleMapsUri: 'https://www.google.com/maps/reviews/data=one',
      visitDate: { year: 2026, month: 7, day: 0 },
    },
    {
      name: `places/${placeId}/reviews/review-two`,
      relativePublishTimeDescription: 'two months ago',
      text: { text: 'Translated detail.', languageCode: 'en' },
      originalText: { text: 'Détail original.', languageCode: 'fr' },
      rating: 2,
      authorAttribution: { displayName: 'Second author', uri: 'https://www.google.com/maps/contrib/200/reviews', photoUri: 'https://lh3.googleusercontent.com/a/example-two' },
      publishTime: '2026-06-20T10:00:00Z',
      flagContentUri: 'https://www.google.com/local/review/rap/report?postId=two',
      googleMapsUri: 'https://www.google.com/maps/reviews/data=two',
    },
  ],
}

const jsonResponse = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...headers } })

test('normalizes a bounded transient attributed relevance sample', () => {
  const result = normalizeObservation({ searchPayload, detailsPayload }, { input, now: () => new Date('2026-08-27T12:00:00Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.reviews.length, 2)
  assert.equal(result.reviews[0].authorAttribution.displayName, 'Required author')
  assert.equal(result.reviews[1].translated, true)
  assert.deepEqual(result.reviews[0].visitDate, { year: 2026, month: 7 })
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.order, 'provider-relevance')
  assert.equal(result.coverage.placeIdentityConfirmedByCaller, false)
  assert.equal(result.retention.mode, 'ephemeral-attributed-display-only')
  assert.equal(result.retention.durableProviderContentAllowed, false)
  assert.equal(result.retention.identityGraphAllowed, false)
  assert.equal(result.billing.maximumCostUsd, MAXIMUM_COST_USD)
})

test('requires the attribution and retention policy acknowledgements before access', () => {
  assert.throws(() => normalizeInput({ ...input, acknowledgeAttributionDisplay: false }), (error) => error instanceof PublicPlaceReviewError && error.code === 'policy-not-acknowledged')
  assert.throws(() => normalizeInput({ ...input, acknowledgeNoDurableRetention: false }), /no-durable-retention/)
  assert.throws(() => normalizeInput({ ...input, usageMode: 'durable-dataset' }), /ephemeral-attributed-research/)
  assert.throws(() => normalizeInput({ ...input, fieldMask: '*' }), /unknown input fields/)
  assert.throws(() => normalizeInput({ ...input, placeId }), /unknown input fields/)
  assert.throws(() => normalizeInput({ ...input, limit: 6 }), /limit/)
})

test('fails closed when attribution, source link, identity or response fields drift', () => {
  const noPhoto = structuredClone(detailsPayload)
  delete noPhoto.reviews[0].authorAttribution.photoUri
  assert.throws(() => normalizeObservation({ searchPayload, detailsPayload: noPhoto }, { input }), /photoUri is invalid/)
  const wrongReview = structuredClone(detailsPayload)
  wrongReview.reviews[0].name = 'places/another-place/reviews/review-one'
  assert.throws(() => normalizeObservation({ searchPayload, detailsPayload: wrongReview }, { input }), /does not belong/)
  const unsafeLink = structuredClone(detailsPayload)
  unsafeLink.reviews[0].googleMapsUri = 'https://example.com/review'
  assert.throws(() => normalizeObservation({ searchPayload, detailsPayload: unsafeLink }, { input }), /outside the reviewed Google origin/)
  const extraField = structuredClone(detailsPayload)
  extraField.reviews[0].authorEmail = 'must-not-appear@example.com'
  assert.throws(() => normalizeObservation({ searchPayload, detailsPayload: extraField }, { input }), /unexpected fields/)
  assert.throws(() => normalizeObservation({ searchPayload: { places: [{ id: placeId }, { id: 'AnotherPlaceId123' }] }, detailsPayload }, { input }), /exactly one/)
})

test('uses exactly one ID-only search and one fixed Place Details call without retry', async () => {
  const calls = []
  const result = await readPublicPlaceReviewSnapshot(input, {
    credentials: { apiKey: 'approved-api-key-that-is-long-enough' },
    now: () => new Date('2026-08-27T12:00:00Z'),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return calls.length === 1 ? jsonResponse(searchPayload) : jsonResponse(detailsPayload)
    },
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://places.googleapis.com/v1/places:searchText')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers['x-goog-fieldmask'], TEXT_SEARCH_FIELD_MASK)
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    textQuery: input.query,
    pageSize: 1,
    languageCode: 'en',
    regionCode: 'US',
    locationBias: { circle: { center: { latitude: 37.422, longitude: -122.084 }, radius: 5000 } },
  })
  assert.match(calls[1].url, new RegExp(`/v1/places/${placeId}\\?languageCode=en&regionCode=US$`))
  assert.equal(calls[1].init.method, 'GET')
  assert.equal(calls[1].init.headers['x-goog-fieldmask'], PLACE_DETAILS_FIELD_MASK)
  assert.equal(calls.every((call) => call.init.headers['x-goog-api-key'] === 'approved-api-key-that-is-long-enough'), true)
  assert.equal(calls.every((call) => !call.url.includes('approved-api-key')), true)

  let attempts = 0
  await assert.rejects(() => readPublicPlaceReviewSnapshot(input, {
    credentials: { apiKey: 'approved-api-key-that-is-long-enough' },
    fetchImpl: async () => { attempts += 1; return jsonResponse({ error: 'rate' }, 429) },
  }), (error) => error instanceof PublicPlaceReviewError && error.code === 'rate-limited')
  assert.equal(attempts, 1)
})

test('enforces JSON response and streaming size bounds', async () => {
  await assert.rejects(() => readPublicPlaceReviewSnapshot(input, {
    credentials: { apiKey: 'approved-api-key-that-is-long-enough' },
    fetchImpl: async () => new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html' } }),
  }), /returned text\/html/)
  await assert.rejects(() => readPublicPlaceReviewSnapshot(input, {
    credentials: { apiKey: 'approved-api-key-that-is-long-enough' },
    maxResponseBytes: 64,
    fetchImpl: async () => jsonResponse(searchPayload, 200, { 'content-length': '1000' }),
  }), (error) => error instanceof PublicPlaceReviewError && error.code === 'response-too-large')
  await assert.rejects(() => readPublicPlaceReviewSnapshot(input, {
    credentials: { apiKey: 'approved-api-key-that-is-long-enough' },
    maximumCostUsd: 1,
  }), /cost bounds/)
})

test('verification redaction stores no Places content, author, review link or result digest', () => {
  const result = normalizeObservation({ searchPayload, detailsPayload }, { input, now: () => new Date('2026-08-27T12:00:00Z') })
  const redacted = redactForVerification(result)
  const serialized = JSON.stringify(redacted)
  assert.equal(redacted.assertions.reviewCount, 2)
  assert.equal(redacted.assertions.authorAttributionObserved, true)
  assert.equal(redacted.assertions.ephemeralOnly, true)
  assert.equal(serialized.includes('Googleplex'), false)
  assert.equal(serialized.includes('Required author'), false)
  assert.equal(serialized.includes('Useful local experience'), false)
  assert.equal(serialized.includes('/maps/reviews/'), false)
  assert.equal(serialized.includes(placeId), false)
  assert.equal(serialized.includes(result.resultDigest), false)
})

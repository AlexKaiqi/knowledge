import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DataForSeoPublicReviewError,
  ENDPOINTS,
  MAXIMUM_COST_USD,
  normalizeInput,
  normalizeTaskSubmission,
  readPublicPlaceReviewSnapshot,
  readSubmittedPublicPlaceReviewSnapshot,
  redactForVerification,
  submitPublicPlaceReviewTask,
} from '../src/index.mjs'

const input = {
  query: 'Central Library Shanghai',
  locationCode: 2156,
  languageCode: 'zh_CN',
  limit: 20,
  sort: 'newest',
  usageMode: 'bounded-public-demand-research',
  acknowledgeNoIdentityGraph: true,
  acknowledgeTransientVerbatimOnly: true,
  acknowledgeTargetTermsReview: true,
}

const taskId = '08271234-1535-0199-0000-123456789abc'

function submissionPayload(overrides = {}) {
  return {
    version: '0.1.20260827',
    status_code: 20000,
    status_message: 'Ok.',
    time: '0.1 sec.',
    cost: 0.0015,
    tasks_count: 1,
    tasks_error: 0,
    tasks: [{
      id: taskId,
      status_code: 20100,
      status_message: 'Task Created.',
      time: '0.1 sec.',
      cost: 0.0015,
      result_count: 0,
      path: ['v3', 'business_data', 'google', 'reviews', 'task_post'],
      data: { api: 'business_data', function: 'google', se: 'google', se_type: 'reviews', keyword: input.query, location_code: input.locationCode, language_code: input.languageCode, depth: 20, sort_by: 'newest', priority: 1 },
      result: null,
      ...overrides,
    }],
  }
}

const review = {
  type: 'google_reviews_search',
  rank_group: 1,
  rank_absolute: 1,
  position: 'right',
  xpath: '/ignored',
  review_text: 'Translated text',
  original_review_text: '排队太久，但工作人员很好。',
  original_language: 'zh',
  time_ago: 'a day ago',
  timestamp: '2026-08-26 08:00:00 +00:00',
  rating: { rating_type: 'Max5', value: 3, votes_count: 2, rating_max: 5 },
  reviews_count: 99,
  photos_count: 41,
  local_guide: true,
  profile_name: 'A Person',
  profile_url: 'https://www.google.com/maps/contrib/123',
  review_url: 'https://www.google.com/maps/reviews/data=review-one',
  profile_image_url: 'https://lh3.googleusercontent.com/avatar',
  owner_answer: 'Please contact Alice at alice@example.test',
  original_owner_answer: null,
  owner_time_ago: 'hours ago',
  owner_timestamp: '2026-08-26 09:00:00 +00:00',
  review_id: 'review-native-id-one',
  images: [{ type: 'images_element', alt: 'person', url: 'https://google.com/image', image_url: 'https://google.com/image.jpg' }],
  review_highlights: [{ feature: 'wait', assessment: 'long' }],
}

function resultPayload({ statusCode = 20000, environment = 'production', item = review } = {}) {
  const data = environment === 'production'
    ? { api: 'business_data', function: 'google', se: 'google', se_type: 'reviews', keyword: input.query, location_code: input.locationCode, language_code: input.languageCode, depth: 20, sort_by: 'newest', priority: 1 }
    : { keyword: 'sandbox dummy', location_code: 2840, language_code: 'en', depth: 20, sort_by: 'newest', priority: 1 }
  const completed = statusCode === 20000
  return {
    version: '0.1.20260827',
    status_code: 20000,
    status_message: 'Ok.',
    time: '0.1 sec.',
    cost: 0,
    tasks_count: 1,
    tasks_error: 0,
    tasks: [{
      id: environment === 'sandbox' ? '00000000-0000-0000-0000-000000000000' : taskId,
      status_code: statusCode,
      status_message: completed ? 'Ok.' : 'Task In Queue.',
      time: '0.1 sec.',
      cost: 0,
      result_count: completed ? 1 : 0,
      path: ['v3', 'business_data', 'google', 'reviews', 'task_get'],
      data,
      result: completed ? [{
        keyword: environment === 'sandbox' ? 'sandbox dummy' : input.query,
        type: 'google_reviews',
        se_domain: 'google.com',
        location_code: environment === 'sandbox' ? 2840 : input.locationCode,
        language_code: environment === 'sandbox' ? 'en' : input.languageCode,
        check_url: 'https://www.google.com/search?q=library+reviews',
        datetime: '2026-08-26 08:01:00 +00:00',
        title: 'Central Library',
        sub_title: 'Shanghai',
        rating: { rating_type: 'Max5', value: 4.2, votes_count: 1200, rating_max: 5 },
        feature_id: 'feature-native',
        place_id: 'place-native',
        cid: 'cid-native',
        reviews_count: 1200,
        items_count: 1,
        items: [item],
      }] : null,
    }],
  }
}

function jsonResponse(value, { status = 200, contentType = 'application/json', headers = {} } = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': contentType, ...headers } })
}

function internalState() {
  return normalizeTaskSubmission(submissionPayload(), { input, now: () => new Date('2026-08-27T00:00:00Z') })
}

test('normalizes a bounded transient newest-first sample and removes reviewer identity', async () => {
  const state = internalState()
  const result = await readSubmittedPublicPlaceReviewSnapshot(state, {
    credentials: { login: 'api-login', password: 'api-password' },
    now: () => new Date('2026-08-27T00:01:00Z'),
    fetchImpl: async () => jsonResponse(resultPayload()),
  })
  assert.equal(result.status, 'completed')
  const output = result.output
  assert.equal(output.conformance.status, 'passed')
  assert.equal(output.reviews.length, 1)
  assert.equal(output.reviews[0].text, review.original_review_text)
  assert.equal(output.reviews[0].ownerResponsePresent, true)
  assert.equal(output.coverage.complete, false)
  assert.equal(output.authorization.targetPlatformAuthorizationVerified, false)
  assert.equal(output.retention.durableVerbatimAllowed, false)
  assert.equal(output.billing.chargedCost, 0.0015)
  const serialized = JSON.stringify(output)
  for (const forbidden of ['A Person', 'alice@example.test', 'profile_name', 'profile_url', 'profile_image_url', 'local_guide', 'review-native-id-one', 'place-native', taskId, 'DataForSEO']) assert.equal(serialized.includes(forbidden), false, forbidden)
})

test('input fixes depth, newest order and policy acknowledgements before any provider call', () => {
  assert.deepEqual(normalizeInput(input), input)
  assert.throws(() => normalizeInput({ ...input, limit: 10 }), /exactly 20/)
  assert.throws(() => normalizeInput({ ...input, sort: 'relevant' }), /newest-first/)
  assert.throws(() => normalizeInput({ ...input, query: 'site:example.com library' }), /advanced search operators/)
  assert.throws(() => normalizeInput({ ...input, acknowledgeNoIdentityGraph: false }), /prohibition/)
  assert.throws(() => normalizeInput({ ...input, connectorId: 'hidden-route' }), /unknown input fields/)
})

test('submits exactly one standard task with Basic Auth, fixed fields and reconciled cost', async () => {
  let calls = 0
  const state = await submitPublicPlaceReviewTask(input, {
    credentials: { login: 'api-login', password: 'api-password' },
    now: () => new Date('2026-08-27T00:00:00Z'),
    fetchImpl: async (url, options) => {
      calls += 1
      assert.equal(url, ENDPOINTS.productionPost)
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.authorization, `Basic ${Buffer.from('api-login:api-password').toString('base64')}`)
      assert.deepEqual(JSON.parse(options.body), [{ keyword: input.query, location_code: input.locationCode, language_code: input.languageCode, depth: 20, sort_by: 'newest', priority: 1 }])
      return jsonResponse(submissionPayload())
    },
  })
  assert.equal(calls, 1)
  assert.equal(state.chargedCostUsd, 0.0015)
  assert.match(state.operationRef, /^operation:[a-f0-9]{64}$/)
  assert.equal(state.providerTaskId, taskId)
  assert.throws(() => normalizeTaskSubmission(submissionPayload({ cost: 0.003 }), { input }), /root and task submission costs differ|cost exceeds/)
})

test('production workflow delegates waiting to the executor and never resubmits or polls itself', async () => {
  const seen = []
  const output = await readPublicPlaceReviewSnapshot(input, {
    environment: 'production',
    credentials: { login: 'api-login', password: 'api-password' },
    now: () => new Date('2026-08-27T00:00:00Z'),
    fetchImpl: async (url) => {
      seen.push(url)
      if (url === ENDPOINTS.productionPost) return jsonResponse(submissionPayload())
      assert.equal(url, `${ENDPOINTS.productionGetBase}${taskId}`)
      return jsonResponse(resultPayload())
    },
    awaitTaskResult: async ({ operationRef, deadlineSeconds, readOnce }) => {
      assert.match(operationRef, /^operation:/)
      assert.equal(deadlineSeconds, 2700)
      return readOnce()
    },
  })
  assert.deepEqual(seen, [ENDPOINTS.productionPost, `${ENDPOINTS.productionGetBase}${taskId}`])
  assert.equal(output.reviews.length, 1)
})

test('pending state returns one opaque operation reference without retrying', async () => {
  let calls = 0
  const state = internalState()
  const result = await readSubmittedPublicPlaceReviewSnapshot(state, {
    credentials: { login: 'api-login', password: 'api-password' },
    fetchImpl: async () => {
      calls += 1
      return jsonResponse(resultPayload({ statusCode: 40602 }))
    },
  })
  assert.equal(calls, 1)
  assert.deepEqual(result, { status: 'pending', operationRef: state.operationRef, retryAfterSeconds: 60 })
  await assert.rejects(() => readPublicPlaceReviewSnapshot(input, { environment: 'production', credentials: { login: 'a', password: 'b' } }), (error) => error instanceof DataForSeoPublicReviewError && error.code === 'workflow-runtime-unavailable')
})

test('sandbox uses only the fixed free dummy result endpoint and declares synthetic coverage', async () => {
  let calls = 0
  const output = await readPublicPlaceReviewSnapshot(input, {
    environment: 'sandbox',
    credentials: { login: 'api-login', password: 'api-password' },
    now: () => new Date('2026-08-27T00:00:00Z'),
    fetchImpl: async (url, options) => {
      calls += 1
      assert.equal(url, ENDPOINTS.sandboxGet)
      assert.equal(options.method, 'GET')
      return jsonResponse(resultPayload({ environment: 'sandbox' }))
    },
  })
  assert.equal(calls, 1)
  assert.equal(output.coverage.representation, 'synthetic-provider-shape-only')
  assert.equal(output.billing.chargedCost, 0)
})

test('verification redaction retains bounds and billing but no content, source identity or digest', async () => {
  const state = internalState()
  const completed = await readSubmittedPublicPlaceReviewSnapshot(state, { credentials: { login: 'a', password: 'b' }, fetchImpl: async () => jsonResponse(resultPayload()) })
  const redacted = redactForVerification(completed.output)
  assert.equal(redacted.coverage.returnedCount, 1)
  assert.equal(redacted.retention.reviewerIdentityRetained, false)
  const serialized = JSON.stringify(redacted)
  for (const forbidden of [input.query, 'Central Library', review.original_review_text, 'www.google.com', 'operation:', 'review-native-id-one', 'resultDigest']) assert.equal(serialized.includes(forbidden), false, forbidden)
})

test('fails closed on identity, cost, hidden field, content type and response-size drift', async () => {
  const state = internalState()
  await assert.rejects(() => readSubmittedPublicPlaceReviewSnapshot(state, { credentials: { login: 'a', password: 'b' }, fetchImpl: async () => jsonResponse(resultPayload({ item: { ...review, hidden_person: 'secret' } })) }), /unexpected fields/)
  const wrongId = resultPayload()
  wrongId.tasks[0].id = '08271234-1535-0199-0000-000000000000'
  await assert.rejects(() => readSubmittedPublicPlaceReviewSnapshot(state, { credentials: { login: 'a', password: 'b' }, fetchImpl: async () => jsonResponse(wrongId) }), /identity changed/)
  await assert.rejects(() => readSubmittedPublicPlaceReviewSnapshot(state, { credentials: { login: 'a', password: 'b' }, fetchImpl: async () => jsonResponse(resultPayload(), { contentType: 'text/html' }) }), /returned text\/html/)
  await assert.rejects(() => readSubmittedPublicPlaceReviewSnapshot(state, { credentials: { login: 'a', password: 'b' }, maxResponseBytes: 300_000, fetchImpl: async () => jsonResponse(resultPayload(), { headers: { 'content-length': '400000' } }) }), /exceeds 300000 bytes/)
  assert.equal(MAXIMUM_COST_USD, 0.002)
})

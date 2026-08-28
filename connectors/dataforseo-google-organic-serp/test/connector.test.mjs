import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENDPOINTS,
  GoogleOrganicSerpError,
  normalizeInput,
  normalizeSerpResponse,
  readGoogleOrganicResultPage,
} from '../src/index.mjs'

const input = { query: 'personal AI assistant memory problems', locationCode: 2840, languageCode: 'en', device: 'desktop', limit: 2 }
const payload = {
  status_code: 20000,
  status_message: 'Ok.',
  cost: 0.002,
  tasks_count: 1,
  tasks_error: 0,
  tasks: [{
    id: '11151456-0696-0066-0000-002a5915da37',
    status_code: 20000,
    status_message: 'Ok.',
    cost: 0.002,
    result_count: 1,
    data: { keyword: input.query, location_code: input.locationCode, language_code: input.languageCode, device: input.device },
    result: [{
      keyword: input.query,
      type: 'organic',
      se_domain: 'google.com',
      location_code: input.locationCode,
      language_code: input.languageCode,
      check_url: 'https://www.google.com/search?q=personal+AI+assistant+memory+problems',
      datetime: '2026-08-27 02:00:00 +00:00',
      se_results_count: 999999,
      items_count: 3,
      items: [
        { type: 'organic', rank_group: 1, rank_absolute: 2, page: 1, title: 'Memory in assistants', url: 'https://example.com/memory', domain: 'example.com', description: 'A bounded description.' },
        { type: 'paid', rank_group: 1, rank_absolute: 1, page: 1, title: 'Advertisement', url: 'https://ads.example/ad', domain: 'ads.example' },
        { type: 'organic', rank_group: 2, rank_absolute: 3, page: 1, title: 'Assistant failure modes', url: 'https://research.example.org/failures', domain: 'research.example.org', description: null },
      ],
    }],
  }],
}

test('normalizes one bounded organic page without provider route or result-count claims', () => {
  const result = normalizeSerpResponse(payload, { input, environment: 'production', now: () => new Date('2026-08-27T02:00:01Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.results.length, 2)
  assert.equal(result.results[0].rank, 1)
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.resultCountEstimateRetained, false)
  assert.equal(result.billing.chargedCost, 0.002)
  assert.equal(JSON.stringify(result).includes('dataforseo'), false)
  assert.equal(JSON.stringify(result).includes('999999'), false)
})

test('rejects route injection, expensive operators and requests beyond one paid page', () => {
  assert.throws(() => normalizeInput({ ...input, endpoint: 'https://attacker.invalid' }), /unknown input fields/)
  assert.throws(() => normalizeInput({ ...input, query: 'site:reddit.com assistant memory' }), (error) => error instanceof GoogleOrganicSerpError && error.code === 'financial-policy')
  assert.throws(() => normalizeInput({ ...input, query: 'assistant\nmemory' }), /single-line/)
  assert.throws(() => normalizeInput({ ...input, limit: 11 }), /between 1 and 10/)
  assert.throws(() => normalizeInput({ ...input, languageCode: '../en' }), /languageCode is invalid/)
  assert.throws(() => normalizeInput({ ...input, device: 'tablet' }), /unsupported device/)
})

test('uses one fixed production request, Basic Auth, bounded fields and no retries', async () => {
  const calls = []
  const result = await readGoogleOrganicResultPage(input, {
    environment: 'production',
    credentials: { login: 'api-login', password: 'api-password' },
    now: () => new Date('2026-08-27T02:00:01Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, ENDPOINTS.production)
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(Buffer.from(calls[0].options.headers.authorization.slice('Basic '.length), 'base64').toString('utf8'), 'api-login:api-password')
  assert.deepEqual(JSON.parse(calls[0].options.body), [{ keyword: input.query, location_code: 2840, language_code: 'en', device: 'desktop', os: 'windows', depth: 2 }])

  let attempts = 0
  await assert.rejects(() => readGoogleOrganicResultPage(input, {
    environment: 'production',
    credentials: { login: 'not-returned', password: 'not-returned-either' },
    fetchImpl: async () => {
      attempts += 1
      return new Response('busy', { status: 429, headers: { 'content-type': 'text/plain' } })
    },
  }), (error) => error.code === 'rate-limited' && !error.message.includes('not-returned'))
  assert.equal(attempts, 1)
})

test('switches only between fixed sandbox and production hosts', async () => {
  let calledUrl
  const sandboxPayload = structuredClone(payload)
  sandboxPayload.tasks[0].data = { keyword: 'dummy', location_code: 0, language_code: 'xx', device: 'desktop' }
  sandboxPayload.tasks[0].result[0].keyword = 'dummy'
  sandboxPayload.tasks[0].result[0].location_code = 0
  sandboxPayload.tasks[0].result[0].language_code = 'xx'
  const result = await readGoogleOrganicResultPage(input, {
    environment: 'sandbox',
    credentials: { login: 'api-login', password: 'api-password' },
    fetchImpl: async (url) => {
      calledUrl = url
      return new Response(JSON.stringify(sandboxPayload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(calledUrl, ENDPOINTS.sandbox)
  assert.equal(result.billing.chargedCost, 0)
  assert.equal(result.query.query, input.query)
})

test('fails closed on identity drift, unsafe results, cost drift and response overflow', async () => {
  const wrongIdentity = structuredClone(payload)
  wrongIdentity.tasks[0].result[0].keyword = 'different query'
  assert.throws(() => normalizeSerpResponse(wrongIdentity, { input, environment: 'production' }), /does not match/)

  const unsafe = structuredClone(payload)
  unsafe.tasks[0].result[0].items[0].url = 'file:///etc/passwd'
  assert.throws(() => normalizeSerpResponse(unsafe, { input, environment: 'production' }), /unsafe/)

  const expensive = structuredClone(payload)
  expensive.tasks[0].cost = 0.02
  assert.throws(() => normalizeSerpResponse(expensive, { input, environment: 'production', maxCostUsd: 0.01 }), (error) => error.code === 'cost-bound-exceeded')

  await assert.rejects(() => readGoogleOrganicResultPage(input, {
    environment: 'production',
    credentials: { login: 'api-login', password: 'api-password' },
    maxResponseBytes: 128,
    fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }),
  }), /exceeds 128 bytes/)
})

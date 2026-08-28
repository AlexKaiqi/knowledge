import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_BASE_URL,
  COLLECT_FIELDS,
  compileSearchRequest,
  JobPostingSnapshotError,
  normalizeInput,
  normalizeJobPostingSnapshot,
  readJobPostingSnapshot,
  redactJobDescriptionsForVerification,
} from '../src/index.mjs'

const input = { queryPhrase: 'AI assistant', country: 'China', startDate: '2026-08-01', endDate: '2026-08-27', limit: 2 }
const records = [
  {
    id: 101, job_id_expired: 0, created_at: '2026-08-20 08:00:00', updated_at: '2026-08-26 08:00:00', date_posted: '2026-08-20 08:00:00', valid_through: null, status: 1,
    title: 'AI Assistant Product Manager', description: 'Find user pain points and design assistant workflows.', country: 'China', city: 'Shanghai', state: 'Shanghai',
    department: 'Product', management_level: 'Manager', seniority: 'Mid-Senior level', functions: ['Product Management'], employment_type: ['Full-time'], accepts_remote: false,
    company_name: 'Example Lab', company_industry: 'Software', salary: [{ min_value: 30000, max_value: 50000, currency: 'CNY', type: 'MONTH', text: 'CNY 30k-50k' }], benefits: ['health insurance'],
    recruiter: { full_name: 'must-disappear' }, latitude: 31.23, longitude: 121.47, job_sources: [{ source_id: 'must-disappear', source: 'network', url: 'https://example.test/job' }],
  },
  {
    id: 102, job_id_expired: 0, created_at: '2026-08-21T08:00:00.000', updated_at: '2026-08-25T08:00:00.000', date_posted: null, valid_through: null, status: 1,
    title: 'Conversational AI Engineer', description: 'Build memory and tool-use evaluation.', country: 'China', city: 'Beijing', state: 'Beijing',
    department: 'Engineering', management_level: null, seniority: null, functions: ['Engineering'], employment_type: ['Full-time'], accepts_remote: true,
    company_name: 'Example Studio', company_industry: 'AI', salary: [], benefits: [],
  },
]

test('compiles caller input into a fixed active-only query without accepting raw DSL', () => {
  const { query, body } = compileSearchRequest(input)
  assert.deepEqual(query, input)
  assert.equal(body.query.bool.must[0].multi_match.query, 'AI assistant')
  assert.equal(body.query.bool.must[1].match_phrase.country, 'China')
  assert.deepEqual(body.query.bool.must[2], { term: { status: 1 } })
  assert.deepEqual(body.query.bool.must[3], { term: { job_id_expired: 0 } })
  assert.throws(() => normalizeInput({ ...input, query: { match_all: {} } }), /unknown input fields/)
  assert.throws(() => normalizeInput({ ...input, startDate: '2026-01-01' }), /between 1 and 30 days/)
  assert.throws(() => normalizeInput({ ...input, limit: 11 }), /between 1 and 10/)
})

test('normalizes a provider-neutral bounded snapshot and drops personal and route fields', () => {
  const result = normalizeJobPostingSnapshot({ ids: [101, 102], records, creditLedger: [500, 499, 498] }, { input, now: () => new Date('2026-08-27T05:00:00Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.postings.length, 2)
  assert.equal(result.billing.actualDebits, 2)
  assert.equal(result.billing.reconciled, true)
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.targetPlatformCoverage, 'unverified')
  assert.equal(result.postings[0].description.excerpt, 'Find user pain points and design assistant workflows.')
  const serialized = JSON.stringify(result)
  for (const forbidden of ['must-disappear', '"recruiter":', 'source_id', 'job_sources', 'latitude', 'longitude', 'coresignal']) assert.equal(serialized.includes(forbidden), false)
  assert.equal(serialized.includes('101'), false)
})

test('performs one free search then serial field-selected collects and reconciles credits', async () => {
  const calls = []
  const payloads = [[101, 102], ...records]
  const balances = ['500', '499', '498']
  const result = await readJobPostingSnapshot(input, {
    credentials: { apiKey: 'secret_api_key_not_returned' },
    now: () => new Date('2026-08-27T05:00:00Z'),
    fetchImpl: async (url, options) => {
      const index = calls.length
      calls.push({ url: String(url), options })
      return new Response(JSON.stringify(payloads[index]), { status: 200, headers: { 'content-type': 'application/json', 'x-credits-remaining': balances[index] } })
    },
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(calls.length, 3)
  const searchUrl = new URL(calls[0].url)
  assert.equal(searchUrl.origin + searchUrl.pathname, `${API_BASE_URL}/search/es_dsl`)
  assert.equal(searchUrl.searchParams.get('items_per_page'), '2')
  assert.equal(calls[0].options.method, 'POST')
  const submitted = JSON.parse(calls[0].options.body)
  assert.equal(submitted.query.bool.must[0].multi_match.query, 'AI assistant')
  for (let index = 1; index < calls.length; index += 1) {
    const collectUrl = new URL(calls[index].url)
    assert.equal(collectUrl.searchParams.getAll('fields').length, COLLECT_FIELDS.length)
    assert.equal(collectUrl.searchParams.getAll('fields').includes('recruiter'), false)
    assert.equal(collectUrl.searchParams.getAll('fields').includes('latitude'), false)
  }
  assert.equal(calls.every((call) => call.options.headers.apikey === 'secret_api_key_not_returned' && call.options.redirect === 'error'), true)
  assert.equal(JSON.stringify(result).includes('secret_api_key_not_returned'), false)
})

test('fails closed on missing billing headers, stale records and unreconciled credits', async () => {
  await assert.rejects(() => readJobPostingSnapshot({ ...input, limit: 1 }, {
    credentials: { apiKey: 'secret' },
    fetchImpl: async () => new Response('[101]', { status: 200, headers: { 'content-type': 'application/json' } }),
  }), (error) => error instanceof JobPostingSnapshotError && error.code === 'billing-ledger-unavailable')

  assert.throws(() => normalizeJobPostingSnapshot({ ids: [101], records: [{ ...records[0], status: 2 }], creditLedger: [500, 499] }, { input: { ...input, limit: 1 } }), /no longer active/)
  const unreconciled = normalizeJobPostingSnapshot({ ids: [101], records: [records[0]], creditLedger: [500, 500] }, { input: { ...input, limit: 1 } })
  assert.equal(unreconciled.conformance.status, 'review-required')
})

test('verification redaction removes retained description excerpt', () => {
  const snapshot = normalizeJobPostingSnapshot({ ids: [101], records: [records[0]], creditLedger: [500, 499] }, { input: { ...input, limit: 1 } })
  const redacted = redactJobDescriptionsForVerification(snapshot)
  assert.equal(redacted.coverage.rawDescriptionRetention, 'redacted')
  assert.equal(Object.hasOwn(redacted.postings[0].description, 'excerpt'), false)
  assert.match(redacted.postings[0].description.sha256, /^[a-f0-9]{64}$/)
})

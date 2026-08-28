import { createHash } from 'node:crypto'

export const API_BASE_URL = 'https://api.coresignal.com/cdapi/v2/job_multi_source'
export const MAX_POSTINGS = 10
export const MAX_DESCRIPTION_EXCERPT = 1_000
export const COLLECT_FIELDS = Object.freeze([
  'id', 'job_id_expired', 'created_at', 'updated_at', 'date_posted', 'valid_through', 'status',
  'title', 'description', 'country', 'city', 'state', 'department', 'management_level', 'seniority',
  'functions', 'employment_type', 'accepts_remote', 'company_name', 'company_industry', 'salary', 'benefits',
])

const ALLOWED_INPUT_KEYS = new Set(['queryPhrase', 'country', 'startDate', 'endDate', 'limit'])
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export class JobPostingSnapshotError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'JobPostingSnapshotError'
    this.code = code
    this.details = details
  }
}

function boundedString(value, field, maximum) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum || /[\r\n\0]/.test(value)) {
    throw new JobPostingSnapshotError('invalid-input', `${field} must be a non-empty single-line string up to ${maximum} characters`)
  }
  return value.trim()
}

function parseDateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new JobPostingSnapshotError('invalid-input', `${field} must use YYYY-MM-DD`)
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new JobPostingSnapshotError('invalid-input', `${field} is invalid`)
  return { value, timestamp }
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new JobPostingSnapshotError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new JobPostingSnapshotError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  const queryPhrase = boundedString(input.queryPhrase, 'queryPhrase', 160)
  const country = boundedString(input.country, 'country', 100)
  const start = parseDateOnly(input.startDate, 'startDate')
  const end = parseDateOnly(input.endDate, 'endDate')
  const spanDays = Math.floor((end.timestamp - start.timestamp) / 86_400_000) + 1
  if (spanDays < 1 || spanDays > 30) throw new JobPostingSnapshotError('invalid-input', 'job window must contain between 1 and 30 days')
  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_POSTINGS) throw new JobPostingSnapshotError('financial-policy', `limit must be an integer between 1 and ${MAX_POSTINGS}`)
  return { queryPhrase, country, startDate: start.value, endDate: end.value, limit }
}

export function compileSearchRequest(input) {
  const query = normalizeInput(input)
  return {
    query,
    body: {
      query: {
        bool: {
          must: [
            { multi_match: { query: query.queryPhrase, fields: ['title', 'description'], type: 'phrase' } },
            { match_phrase: { country: query.country } },
            { term: { status: 1 } },
            { term: { job_id_expired: 0 } },
            { range: { updated_at: { gte: `${query.startDate} 00:00:00`, lte: `${query.endDate} 23:59:59` } } },
          ],
        },
      },
      sort: ['_score'],
    },
  }
}

function normalizeApiKey(credentials) {
  const apiKey = credentials?.apiKey
  if (typeof apiKey !== 'string' || apiKey.length < 1 || apiKey.length > 2048 || /[\s\0]/.test(apiKey)) throw new JobPostingSnapshotError('credential-unavailable', 'provider API key is unavailable')
  return apiKey
}

function parseCredits(response, stage) {
  const raw = response.headers.get('x-credits-remaining')
  if (raw === null || !/^\d+$/.test(raw)) throw new JobPostingSnapshotError('billing-ledger-unavailable', `${stage} response omitted a valid x-credits-remaining header`)
  return Number(raw)
}

async function readJsonWithLimit(response, maxResponseBytes, stage) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new JobPostingSnapshotError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
  const text = await response.text()
  if (Buffer.byteLength(text) > maxResponseBytes) throw new JobPostingSnapshotError('response-too-large', `${stage} response exceeds ${maxResponseBytes} bytes`)
  try { return JSON.parse(text) } catch { throw new JobPostingSnapshotError('response-shape-changed', `${stage} response is not valid JSON`) }
}

async function requestJson(url, { fetchImpl, apiKey, timeoutMs, maxResponseBytes, userAgent, method = 'GET', body, stage }) {
  const response = await fetchImpl(url, {
    method,
    headers: { accept: 'application/json', apikey: apiKey, 'user-agent': userAgent, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 401 ? 'authentication-failed'
      : response.status === 402 || response.status === 403 ? 'access-or-credit-required'
        : response.status === 409 ? 'duplicate-request-in-progress'
          : response.status === 429 ? 'rate-limited'
            : 'http-error'
    throw new JobPostingSnapshotError(code, `${stage} request failed: HTTP_${response.status}`, { stage, status: response.status })
  }
  const creditsRemaining = parseCredits(response, stage)
  const payload = await readJsonWithLimit(response, maxResponseBytes, stage)
  return { payload, creditsRemaining }
}

function nullableString(value, field, maximum = 16_000) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maximum) throw new JobPostingSnapshotError('response-shape-changed', `${field} is invalid`)
  return value
}

function stringArray(value, field, maximum = 50) {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || item.length > 1_000)) throw new JobPostingSnapshotError('response-shape-changed', `${field} is invalid`)
  return value
}

function timestamp(value, field, { nullable = true } = {}) {
  if (nullable && (value === null || value === undefined)) return null
  if (typeof value !== 'string' || value.length > 64) throw new JobPostingSnapshotError('response-shape-changed', `${field} is invalid`)
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  const parsed = Date.parse(withZone)
  if (!Number.isFinite(parsed)) throw new JobPostingSnapshotError('response-shape-changed', `${field} is invalid`)
  return new Date(parsed).toISOString()
}

function normalizeSalary(value) {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.length > 20) throw new JobPostingSnapshotError('response-shape-changed', 'salary is invalid')
  return value.map((salary) => {
    if (!salary || typeof salary !== 'object' || Array.isArray(salary)) throw new JobPostingSnapshotError('response-shape-changed', 'salary entry is invalid')
    const min = salary.min_value ?? null
    const max = salary.max_value ?? null
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) throw new JobPostingSnapshotError('response-shape-changed', 'salary value is invalid')
    return { minimum: min, maximum: max, currency: nullableString(salary.currency, 'salary currency', 16), period: nullableString(salary.type, 'salary period', 32), text: nullableString(salary.text, 'salary text', 1_000) }
  })
}

function normalizePosting(raw, { query }) {
  if (!raw || (typeof raw.id !== 'number' && typeof raw.id !== 'string') || String(raw.id).length > 128) throw new JobPostingSnapshotError('response-shape-changed', 'job ID is invalid')
  if (raw.status !== 1 || raw.job_id_expired !== 0) throw new JobPostingSnapshotError('response-identity-drift', 'collected job is no longer active')
  const description = nullableString(raw.description, 'description', 200_000) ?? ''
  return {
    observationId: sha256(`job\0${raw.id}`),
    title: nullableString(raw.title, 'title', 2_000),
    companyName: nullableString(raw.company_name, 'company name', 2_000),
    companyIndustry: nullableString(raw.company_industry, 'company industry', 1_000),
    location: { country: nullableString(raw.country, 'country', 1_000), city: nullableString(raw.city, 'city', 1_000), state: nullableString(raw.state, 'state', 1_000) },
    createdAt: timestamp(raw.created_at, 'createdAt', { nullable: false }),
    updatedAt: timestamp(raw.updated_at, 'updatedAt', { nullable: false }),
    datePosted: timestamp(raw.date_posted, 'datePosted'),
    validThrough: timestamp(raw.valid_through, 'validThrough'),
    active: true,
    department: nullableString(raw.department, 'department', 1_000),
    managementLevel: nullableString(raw.management_level, 'management level', 1_000),
    seniority: nullableString(raw.seniority, 'seniority', 1_000),
    functions: stringArray(raw.functions, 'functions'),
    employmentTypes: stringArray(raw.employment_type, 'employment types'),
    acceptsRemote: raw.accepts_remote === null || raw.accepts_remote === undefined ? null : Boolean(raw.accepts_remote),
    salary: normalizeSalary(raw.salary),
    benefits: stringArray(raw.benefits, 'benefits'),
    description: { excerpt: description.slice(0, MAX_DESCRIPTION_EXCERPT), length: description.length, sha256: sha256(description), truncated: description.length > MAX_DESCRIPTION_EXCERPT },
  }
}

function containsForbiddenRouteField(value) {
  if (!value || typeof value !== 'object') return false
  const forbidden = new Set(['recruiter', 'profile_url', 'source_id', 'external_url', 'job_sources', 'latitude', 'longitude', 'id'])
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || containsForbiddenRouteField(nested))
}

export function normalizeJobPostingSnapshot({ ids, records, creditLedger }, { input, now = () => new Date() } = {}) {
  const query = normalizeInput(input)
  if (!Array.isArray(ids) || ids.length > query.limit || ids.some((id) => (typeof id !== 'number' && typeof id !== 'string') || String(id).length > 128)) throw new JobPostingSnapshotError('response-shape-changed', 'search response must be a bounded ID array')
  if (!Array.isArray(records) || records.length !== ids.length) throw new JobPostingSnapshotError('response-shape-changed', 'every returned ID must have exactly one collected record')
  if (!Array.isArray(creditLedger) || creditLedger.length !== 1 + records.length || creditLedger.some((value) => !Number.isInteger(value) || value < 0)) throw new JobPostingSnapshotError('billing-ledger-unavailable', 'credit ledger is incomplete')
  const expectedDebits = records.length
  const actualDebits = creditLedger[0] - creditLedger.at(-1)
  const postings = records.map((record, index) => {
    if (String(record.id) !== String(ids[index])) throw new JobPostingSnapshotError('response-identity-drift', 'collected job ID differs from search result')
    return normalizePosting(record, { query })
  })
  const projection = {
    sourceClass: 'commercial-multi-source-jobs',
    query,
    coverage: { representation: 'bounded-active-job-posting-snapshot', returnedCount: postings.length, complete: false, sourceCoverage: 'provider-multi-source-undisclosed', targetPlatformCoverage: 'unverified', recruiterIdentityRetained: false, exactLocationRetained: false, rawDescriptionRetention: 'transient-excerpt' },
    billing: { unit: 'provider-credit', expectedMaximumCredits: query.limit, expectedDebits, actualDebits, reconciled: actualDebits === expectedDebits },
    postings,
    observedAt: now().toISOString(),
  }
  const assertions = [
    { id: 'bounded-results', passed: postings.length <= query.limit && query.limit <= MAX_POSTINGS },
    { id: 'active-only', passed: postings.every((posting) => posting.active) },
    { id: 'identity-and-route-removed', passed: projection.sourceClass === 'commercial-multi-source-jobs' && postings.every((posting) => !containsForbiddenRouteField(posting)) },
    { id: 'billing-reconciled', passed: projection.billing.reconciled && actualDebits <= query.limit },
  ]
  return { ...projection, resultDigest: sha256(JSON.stringify(projection)), conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions } }
}

export async function readJobPostingSnapshot(input, { fetchImpl = fetch, credentials, timeoutMs = 30_000, maxResponseBytes = 2_097_152, maxCreditsPerInvocation = 10, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const { query, body } = compileSearchRequest(input)
  if (maxCreditsPerInvocation !== MAX_POSTINGS) throw new JobPostingSnapshotError('configuration-error', `maxCreditsPerInvocation must remain fixed at ${MAX_POSTINGS}`)
  const apiKey = normalizeApiKey(credentials)
  const searchUrl = new URL(`${API_BASE_URL}/search/es_dsl`)
  searchUrl.searchParams.set('items_per_page', String(query.limit))
  const search = await requestJson(searchUrl, { fetchImpl, apiKey, timeoutMs, maxResponseBytes, userAgent, method: 'POST', body, stage: 'search' })
  if (!Array.isArray(search.payload) || search.payload.length > query.limit) throw new JobPostingSnapshotError('response-shape-changed', 'search response must be a bounded ID array')
  const creditLedger = [search.creditsRemaining]
  const records = []
  for (const id of search.payload) {
    const collectUrl = new URL(`${API_BASE_URL}/collect/${encodeURIComponent(String(id))}`)
    for (const field of COLLECT_FIELDS) collectUrl.searchParams.append('fields', field)
    const collected = await requestJson(collectUrl, { fetchImpl, apiKey, timeoutMs, maxResponseBytes, userAgent, stage: 'collect' })
    records.push(collected.payload)
    creditLedger.push(collected.creditsRemaining)
  }
  return normalizeJobPostingSnapshot({ ids: search.payload, records, creditLedger }, { input: query, now })
}

export function redactJobDescriptionsForVerification(snapshot) {
  return {
    ...snapshot,
    coverage: { ...snapshot.coverage, rawDescriptionRetention: 'redacted' },
    postings: snapshot.postings.map((posting) => ({ ...posting, description: { length: posting.description.length, sha256: posting.description.sha256, truncated: posting.description.truncated } })),
  }
}

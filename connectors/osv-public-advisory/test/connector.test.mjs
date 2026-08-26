import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RESPONSE_BYTES, normalizePublicAdvisoryResponse, OsvPublicAdvisoryError, readPublicAdvisory } from '../src/index.mjs'

const input = { advisoryId: 'OSV-2020-111' }
const payload = (overrides = {}) => ({
  schema_version: '1.7.3', id: 'OSV-2020-111', modified: '2022-04-13T03:04:37.331327Z', published: '2020-06-24T01:51:14.570467Z',
  summary: 'Heap-use-after-free', details: 'details', aliases: null, severity: null,
  affected: [{ package: { ecosystem: 'OSS-Fuzz', name: 'poppler', purl: 'pkg:generic/poppler' }, ranges: [{ type: 'GIT', repo: 'https://example.com/repo.git', events: [{ introduced: 'a' }, { fixed: 'b' }] }], versions: ['2.0', '1.0'], database_specific: { secret: 'excluded' } }],
  references: [{ type: 'REPORT', url: 'https://example.com/report' }], credits: [{ name: 'excluded-person' }], ...overrides,
})

test('normalizes exact OSV metadata, ranges, and bounded version coverage', () => {
  const result = normalizePublicAdvisoryResponse(payload(), { input })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.advisory.affected[0].ranges[0].events, [{ kind: 'introduced', value: 'a' }, { kind: 'fixed', value: 'b' }])
  assert.deepEqual(result.advisory.affected[0].versions.sample, ['1.0', '2.0'])
  assert.equal(JSON.stringify(result).includes('excluded-person'), false)
  assert.equal(JSON.stringify(result).includes('database_specific'), false)
})

test('rejects identifier injection and malformed range boundaries before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicAdvisory({ advisoryId: '../all' }, { fetchImpl }), /exact case-sensitive/)
  await assert.rejects(() => readPublicAdvisory({ ...input, baseUrl: 'https://example.com' }, { fetchImpl }), /unknown input/)
  assert.throws(() => normalizePublicAdvisoryResponse(payload({ affected: [{ package: { ecosystem: 'Go', name: 'x' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0', fixed: '1' }] }] }] }), { input }), /exactly one/)
  assert.equal(calls, 0)
})

test('uses one fixed request and exposes missing/rate-limit results without retry', async () => {
  let calls = 0
  const ok = async (url, options) => { calls += 1; assert.equal(url.href, 'https://api.osv.dev/v1/vulns/OSV-2020-111'); assert.equal(options.redirect, 'error'); return new Response(JSON.stringify(payload()), { status: 200, headers: { 'content-type': 'application/json' } }) }
  assert.equal((await readPublicAdvisory(input, { fetchImpl: ok })).advisory.id, input.advisoryId)
  await assert.rejects(() => readPublicAdvisory(input, { fetchImpl: async () => { calls += 1; return new Response('{}', { status: 404 }) } }), (error) => error instanceof OsvPublicAdvisoryError && error.code === 'advisory-not-found')
  await assert.rejects(() => readPublicAdvisory(input, { fetchImpl: async () => { calls += 1; return new Response('{}', { status: 429, headers: { 'retry-after': '60' } }) }, now: () => new Date('2026-08-27T00:00:00Z') }), (error) => error instanceof OsvPublicAdvisoryError && error.code === 'rate-limited' && error.retryAt === '2026-08-27T00:01:00.000Z')
  assert.equal(calls, 3)
})

test('enforces response budget and identity', async () => {
  assert.throws(() => normalizePublicAdvisoryResponse(payload({ id: 'OTHER-1' }), { input }), /identity/)
  await assert.rejects(() => readPublicAdvisory(input, { fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }) }), /2 MiB/)
})

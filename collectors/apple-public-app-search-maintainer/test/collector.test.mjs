import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applePublicAppSearchSources,
  collectApplePublicAppSearchMaintenance,
  EXPECTED_APP_ID,
} from '../src/index.mjs'
import { ApplePublicAppSearchError } from '../../../connectors/apple-public-app-search/src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentResult = {
  source: { contractStatus: 'official-documentation-archive' },
  coverage: { returnedCount: 1, metadataOnly: true, corpusComplete: false, rankingSemantics: 'apple-search-api-unspecified', resultCountSemantics: 'returned-page-size-only' },
  items: [{ appId: EXPECTED_APP_ID, description: 'must-not-leak' }],
  observedAt: '2026-08-27T05:30:00Z',
  conformance: { status: 'passed' },
}
const currentReport = { expiresAt: '2026-09-03T05:26:44Z' }

test('maintainer stays current only with official semantics, live fixture and fresh proof', async () => {
  const result = await collectApplePublicAppSearchMaintenance({ now: () => new Date('2026-08-27T06:00:00Z'), sourceCheck: currentSource, reader: async () => currentResult, report: currentReport })
  assert.equal(applePublicAppSearchSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
})

test('policy, contract and fixture drift remain separate proposals', async () => {
  const result = await collectApplePublicAppSearchMaintenance({
    now: () => new Date('2026-08-27T06:00:00Z'),
    sourceCheck: async (source) => ['app-review-guidelines', 'search-api-contract'].includes(source.id) ? { id: source.id, status: 'review-required' } : currentSource(source),
    reader: async () => ({ ...currentResult, coverage: { ...currentResult.coverage, rankingSemantics: 'unknown-new-contract' }, items: [{ appId: '1' }] }),
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-apple-search-api-contract-change',
    'review-apple-data-use-policy-change',
    'review-apple-public-search-live-contract',
    'review-apple-search-fixture-disappearance',
  ])
})

test('temporary failure and expired evidence request approved probes without retry', async () => {
  let calls = 0
  const result = await collectApplePublicAppSearchMaintenance({
    now: () => new Date('2026-09-04T00:00:00Z'), sourceCheck: currentSource,
    reader: async () => { calls += 1; throw new ApplePublicAppSearchError('temporarily-unavailable', 'HTTP_503') }, report: currentReport,
  })
  assert.equal(calls, 1)
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['rerun-apple-search-probe-later', 'rerun-apple-public-search-live-probe'])
})

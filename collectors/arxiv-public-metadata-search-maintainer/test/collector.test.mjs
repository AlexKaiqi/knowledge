import assert from 'node:assert/strict'
import test from 'node:test'
import { arxivSources, collectArxivPublicMetadataSearchMaintenance } from '../src/index.mjs'
import { ArxivMetadataSearchError } from '../../../connectors/arxiv-public-metadata-search/src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentResult = { coverage: { returnedCount: 1, totalResults: 100, contentFilesRetained: false, checkpointSemantics: 'offset-is-not-stable-delta' }, entries: [{ publishedAt: '2026-08-27T00:00:00Z', summary: 'must-not-leak' }], conformance: { status: 'passed' } }
const currentReport = { expiresAt: '2026-09-03T00:00:00Z' }

test('maintainer stays current on docs, policy, live shape and report freshness', async () => {
  const result = await collectArxivPublicMetadataSearchMaintenance({ now: () => new Date('2026-08-27T04:00:00Z'), sourceCheck: currentSource, reader: async () => currentResult, report: currentReport })
  assert.equal(arxivSources.length, 2)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
})

test('policy drift and connector drift create different proposals', async () => {
  const result = await collectArxivPublicMetadataSearchMaintenance({
    now: () => new Date('2026-08-27T04:00:00Z'),
    sourceCheck: async (source) => source.id === 'api-terms' ? { id: source.id, status: 'review-required' } : currentSource(source),
    reader: async () => ({ ...currentResult, coverage: { ...currentResult.coverage, contentFilesRetained: true } }),
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-arxiv-api-policy-change', 'review-arxiv-live-contract'])
})

test('temporary failure and expired verification request probes without retry', async () => {
  let calls = 0
  const result = await collectArxivPublicMetadataSearchMaintenance({
    now: () => new Date('2026-09-04T00:00:00Z'), sourceCheck: currentSource,
    reader: async () => { calls += 1; throw new ArxivMetadataSearchError('temporarily-unavailable', 'HTTP_503') }, report: currentReport,
  })
  assert.equal(calls, 1)
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['rerun-arxiv-probe-later', 'rerun-arxiv-live-probe'])
})

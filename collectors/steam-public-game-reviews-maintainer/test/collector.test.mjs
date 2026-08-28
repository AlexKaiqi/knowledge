import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamPublicGameReviewsMaintenance, officialSources } from '../src/index.mjs'
import { SteamPublicReviewError } from '../../../connectors/steam-public-game-reviews/src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentResult = {
  coverage: { returnedCount: 1, authorIdentityRetained: false, corpusComplete: false },
  summary: { totalReviews: 102 },
  reviews: [{ updatedAt: '2026-08-27T00:00:00Z', text: { value: 'must-not-leak' } }],
  conformance: { status: 'passed', assertions: [{ id: 'response-shape', passed: true }] },
}
const currentReport = { expiresAt: '2026-09-03T01:02:20.796Z' }
const currentProjectionReport = { expiresAt: '2026-09-03T01:02:20.796Z' }

test('Steam review maintainer stays current on official semantics, live behavior and freshness', async () => {
  const result = await collectSteamPublicGameReviewsMaintenance({
    now: () => new Date('2026-08-27T02:00:00Z'),
    sourceCheck: currentSource,
    reader: async () => currentResult,
    report: currentReport,
    projectionReport: currentProjectionReport,
  })
  assert.equal(officialSources.length, 2)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
})

test('Steam review maintainer separates documentation drift from connector drift', async () => {
  const result = await collectSteamPublicGameReviewsMaintenance({
    now: () => new Date('2026-08-27T02:00:00Z'),
    sourceCheck: async (source) => source.id === 'review-list-api' ? { id: source.id, status: 'review-required' } : currentSource(source),
    reader: async () => ({ ...currentResult, conformance: { status: 'review-required', assertions: [{ id: 'summary-count', passed: false }] } }),
    report: currentReport,
    projectionReport: currentProjectionReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-steam-review-documentation', 'review-steam-public-review-contract'])
})

test('Steam review maintainer defers rate limits and requests an expired probe without retrying', async () => {
  let calls = 0
  const result = await collectSteamPublicGameReviewsMaintenance({
    now: () => new Date('2026-09-04T00:00:00Z'),
    sourceCheck: currentSource,
    reader: async () => {
      calls += 1
      throw new SteamPublicReviewError('http-error', 'HTTP_429', { status: 429 })
    },
    report: currentReport,
    projectionReport: currentProjectionReport,
  })
  assert.equal(calls, 1)
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['rerun-after-rate-limit', 'rerun-live-probe', 'rerun-observation-projection-probe'])
})

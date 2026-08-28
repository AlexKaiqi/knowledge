import assert from 'node:assert/strict'
import test from 'node:test'
import { collectTikTokRouteMaintenance } from '../src/index.mjs'

test('preserves researched route boundaries without activating them', () => {
  assert.deepEqual(collectTikTokRouteMaintenance().proposals, [])
})
test('keeps eligibility, API contract and route health drift as proposals', () => {
  const result = collectTikTokRouteMaintenance({ sourceChanges: [{ id: 'tiktok-research-faq', previous: 'non-commercial', current: 'changed' }], routeHealth: [{ id: 'tiktok-official-display-api-owned', status: 'unreachable' }] })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((item) => item.kind), ['knowledge-proposal', 'connector-change-proposal'])
})

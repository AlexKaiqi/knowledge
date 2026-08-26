import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDouyinOpenPlatformMaintenance } from '../src/index.mjs'

test('proposes review when the accepted official surface changes', async () => {
  const result = await collectDouyinOpenPlatformMaintenance({ reader: async () => ({ semanticDigest: 'changed', conformance: { status: 'passed', assertions: [] } }), now: () => new Date('2026-08-27T12:00:00Z') })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-official-douyin-change'), true)
})

test('turns source failures into connector proposals', async () => {
  const result = await collectDouyinOpenPlatformMaintenance({ reader: async () => { throw new Error('network unavailable') } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].kind, 'connector-change-proposal')
})

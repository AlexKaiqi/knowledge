import assert from 'node:assert/strict'
import test from 'node:test'
import { collectAccountDocsMaintenance } from '../src/index.mjs'

test('proposes review when the accepted semantic surface changes', async () => {
  const reader = async () => ({ semanticDigest: 'changed', conformance: { status: 'passed', assertions: [] } })
  const result = await collectAccountDocsMaintenance({ reader, now: () => new Date('2026-08-27T12:00:00Z') })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-official-account-api-change'), true)
})

test('turns source failures into connector proposals', async () => {
  const reader = async () => { throw new Error('network unavailable') }
  const result = await collectAccountDocsMaintenance({ reader })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].kind, 'connector-change-proposal')
})

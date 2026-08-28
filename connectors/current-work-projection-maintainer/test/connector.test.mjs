import assert from 'node:assert/strict'
import test from 'node:test'
import { maintainCurrentWorkProjection } from '../src/index.mjs'

const input = {
  currentSessionRef: 'session:current-1',
  workspaceRef: 'workspace:primary',
  instruction: 'Preserve current goals, progress, blockers and next steps; propose only explicit durable decisions.',
  acceptUnconfirmedKnowledgeProposals: true,
}

function provider(overrides = {}) {
  return async () => ({
    status: 'updated',
    reason: null,
    current: {
      path: '.pkb/current.md',
      hash: 'a'.repeat(64),
      chars: 320,
      sessionReferences: ['session:prior-1', 'session:current-1'],
    },
    proposalIds: ['proposal-1'],
    checkpointAdvanced: true,
    durableKnowledgeModified: false,
    gitCommitted: false,
    ...overrides,
  })
}

test('reports only bounded mutation facts and unconfirmed proposal references', async () => {
  const result = await maintainCurrentWorkProjection(input, { curateCurrentSession: provider() })
  assert.equal(result.status, 'updated')
  assert.equal(result.currentProjectionModified, true)
  assert.equal(result.checkpointAdvanced, true)
  assert.deepEqual(result.proposalRefs, ['knowledge-proposal:proposal-1'])
  assert.equal(result.coverage.rawSessionTextReturned, false)
  assert.equal(result.coverage.currentProjectionComplete, false)
  assert.equal(result.coverage.proposalsUnconfirmed, true)
  assert.equal(result.durableKnowledgeModified, false)
  assert.equal(result.gitCommitted, false)
  assert.equal(result.executionAuthorized, false)
})

test('passes only opaque routing and curation intent to the hidden provider', async () => {
  let observed
  await maintainCurrentWorkProjection(input, { curateCurrentSession: async (options) => {
    observed = options
    return provider()()
  } })
  assert.deepEqual(observed, {
    currentSessionId: 'current-1',
    currentSessionRef: 'session:current-1',
    workspaceRef: 'workspace:primary',
    instruction: input.instruction,
    acceptUnconfirmedKnowledgeProposals: true,
  })
  assert.equal(JSON.stringify(observed).includes('transcript'), false)
  assert.equal(JSON.stringify(observed).includes('/private/'), false)
})

test('maps honest skip states without claiming a write', async () => {
  for (const [reason, status] of [['no-text', 'no-new-session-text'], ['no-text-model', 'no-text-model'], ['curate-cooldown', 'cooldown']]) {
    const result = await maintainCurrentWorkProjection(input, { curateCurrentSession: provider({ status: 'skipped', reason, current: null, proposalIds: [], checkpointAdvanced: false }) })
    assert.equal(result.status, status)
    assert.equal(result.currentProjectionModified, false)
    assert.equal(result.currentProjectionDigest, null)
  }
})

test('fails closed on hidden fields, missing source, excessive proposals and authority drift', async () => {
  await assert.rejects(maintainCurrentWorkProjection(input, { curateCurrentSession: provider({ model: 'hidden' }) }), /unsupported fields/)
  await assert.rejects(maintainCurrentWorkProjection(input, { curateCurrentSession: provider({ current: { path: '.pkb/current.md', hash: 'a'.repeat(64), chars: 10, sessionReferences: ['session:prior-1'] } }) }), /does not cite the current Session/)
  await assert.rejects(maintainCurrentWorkProjection(input, { curateCurrentSession: provider({ proposalIds: ['a', 'b', 'c', 'd', 'e'] }) }), /proposal ids/)
  await assert.rejects(maintainCurrentWorkProjection(input, { curateCurrentSession: provider({ durableKnowledgeModified: true }) }), /unconfirmed-proposal boundary/)
  await assert.rejects(maintainCurrentWorkProjection({ ...input, transcript: 'private' }, { curateCurrentSession: provider() }), /unsupported fields/)
  await assert.rejects(maintainCurrentWorkProjection({ ...input, acceptUnconfirmedKnowledgeProposals: false }, { curateCurrentSession: provider() }), /must be true/)
})

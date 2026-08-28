import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileCurrentWorkProjection } from '../src/index.mjs'

const input = { currentSessionRef: 'session:current-1', workspaceRef: 'workspace:primary', acceptUnconfirmedKnowledgeProposals: true }

const provider = (overrides = {}) => async () => ({
  status: 'reconciled', reason: null,
  current: { path: '.pkb/current.md', hash: 'a'.repeat(64), chars: 420, sessionReferences: ['session:prior-1', 'session:prior-2'] },
  reconciledSessionRefs: ['session:prior-1', 'session:prior-2'],
  checkpointAdvancedSessionRefs: ['session:prior-1', 'session:prior-2'],
  skippedSessionRefs: [], proposalIds: ['proposal-1'],
  durableKnowledgeModified: false, gitCommitted: false,
  ...overrides,
})

test('reports bounded startup reconciliation without returning provider internals', async () => {
  let routed
  const result = await reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: async (request) => { routed = request; return provider()() } })
  assert.equal(routed.currentSessionId, 'current-1')
  assert.equal(routed.excludeCurrentSession, true)
  assert.equal(result.status, 'reconciled')
  assert.deepEqual(result.reconciledSessionRefs, ['session:prior-1', 'session:prior-2'])
  assert.equal(result.currentProjectionModified, true)
  assert.equal(result.checkpointsModified, true)
  assert.equal(result.coverage.fullProjectionRebuild, false)
  assert.equal(result.coverage.cursorReset, false)
  assert.equal(result.durableKnowledgeModified || result.gitCommitted || result.executionAuthorized, false)
  assert.equal(JSON.stringify(result).includes('cursor'), true)
  assert.equal(Object.hasOwn(result, 'model'), false)
})

test('maps an exact replay to no observed increments and no mutation facts', async () => {
  const result = await reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: provider({ status: 'no-observed-session-increments', current: null, reconciledSessionRefs: [], checkpointAdvancedSessionRefs: [], proposalIds: [] }) })
  assert.equal(result.status, 'no-observed-session-increments')
  assert.equal(result.currentProjectionModified || result.checkpointsModified, false)
  assert.deepEqual(result.proposalRefs, [])
})

test('preserves partial reconciliation and explicitly reports skipped opaque Sessions', async () => {
  const result = await reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: provider({
    status: 'partial', reason: 'no-text-model', reconciledSessionRefs: ['session:prior-1'], checkpointAdvancedSessionRefs: ['session:prior-1'], skippedSessionRefs: ['session:prior-2'],
    current: { path: '.pkb/current.md', hash: 'b'.repeat(64), chars: 300, sessionReferences: ['session:prior-1'] }, proposalIds: [],
  }) })
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.skippedSessionRefs, ['session:prior-2'])
  assert.equal(result.coverage.sessionEnumerationComplete, false)
  assert.equal(result.coverage.sourceFailuresFullyObservable, false)
})

test('fails closed on current-session inclusion, hidden fields and provider authority drift', async () => {
  await assert.rejects(reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: provider({ reconciledSessionRefs: ['session:current-1'] }) }), /exclude the current Session/)
  await assert.rejects(reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: provider({ token: 'secret' }) }), /unsupported fields/)
  await assert.rejects(reconcileCurrentWorkProjection(input, { reconcilePersistedSessions: provider({ durableKnowledgeModified: true }) }), /unconfirmed-proposal boundary/)
  await assert.rejects(reconcileCurrentWorkProjection({ ...input, cursor: 42 }, { reconcilePersistedSessions: provider() }), /unsupported fields/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collectFeedbackIntakeLocalRetentionExpiryMaintenance, feedbackIntakeLocalRetentionExpirySources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2027-03-27T00:00:00Z' }
const candidate = { storeRef: 'feedback-store:owner-primary', storageReceiptRef: 'feedback-intake-storage:one', recordDigest: `sha256:${'a'.repeat(64)}`, retentionPolicyRef: 'retention:feedback-180d', deleteAfter: '2027-02-23T08:00:00Z', due: true }

test('future inventory and current semantics remain proposal-free', async () => {
  const future = { ...candidate, deleteAfter: '2027-02-24T08:00:00Z', due: false }
  const result = await collectFeedbackIntakeLocalRetentionExpiryMaintenance({ now: () => new Date('2027-02-23T08:00:00Z'), sourceCheck: currentSource, report: currentReport, retentionCandidates: [future] })
  assert.equal(feedbackIntakeLocalRetentionExpirySources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.candidateSummary, { observed: 1, due: 0 })
  assert.deepEqual(result.proposals, [])
})

test('due inventory only proposes explicit grant-gated deletion and never executes it', async () => {
  const result = await collectFeedbackIntakeLocalRetentionExpiryMaintenance({ now: () => new Date('2027-02-23T08:00:01Z'), sourceCheck: currentSource, report: currentReport, retentionCandidates: [candidate] })
  assert.deepEqual(result.proposals, [{
    kind: 'knowledge-proposal', action: 'review-due-retention-deletion', capabilityRef: '/capabilities/feedback/expire-consented-intake-record.md',
    target: { storeRef: candidate.storeRef, storageReceiptRef: candidate.storageReceiptRef, recordDigest: candidate.recordDigest, retentionPolicyRef: candidate.retentionPolicyRef, deleteAfter: '2027-02-23T08:00:00.000Z' },
    requires: ['trusted-retention-grant', 'hold-status-clear', 'explicit-execution'],
  }])
})

test('clock drift, source drift and expired proof remain separate proposals', async () => {
  const result = await collectFeedbackIntakeLocalRetentionExpiryMaintenance({
    now: () => new Date('2027-03-28T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'node-filesystem-api' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report: currentReport,
    retentionCandidates: [{ ...candidate, due: false }],
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'review-retention-deletion-filesystem-semantics', sourceId: 'node-filesystem-api', observedDigest: 'f'.repeat(64) },
    { kind: 'connector-change-proposal', action: 'review-retention-candidate-clock-drift', storageReceiptRef: candidate.storageReceiptRef, declaredDue: false, observedDue: true },
    { kind: 'verification-report', action: 'rerun-isolated-retention-expiry-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-retention-expiry-local.json' },
  ])
})

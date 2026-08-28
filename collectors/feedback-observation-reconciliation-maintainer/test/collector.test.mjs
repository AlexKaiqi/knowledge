import assert from 'node:assert/strict'
import test from 'node:test'
import { collectFeedbackObservationReconciliationMaintenance, feedbackReconciliationSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-27T00:00:00Z' }

test('current production contracts and fresh proof produce no proposal', async () => {
  const result = await collectFeedbackObservationReconciliationMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(feedbackReconciliationSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving production drift is reviewed but never adopted', async () => {
  const result = await collectFeedbackObservationReconciliationMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'feedback-contract-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-upstream-feedback-contract-change', sourceId: 'feedback-contract-main', observedDigest: 'f'.repeat(64) }])
})

test('expired proof only requests an effect-free local rerun', async () => {
  const result = await collectFeedbackObservationReconciliationMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-observation-reconciliation-local.json' }])
})

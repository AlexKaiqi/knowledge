import assert from 'node:assert/strict'
import test from 'node:test'
import { collectFeedbackThemeSynthesisMaintenance, feedbackThemeSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-11T00:00:00Z' }

test('current learning contracts and fresh local proof remain proposal-free', async () => {
  const result = await collectFeedbackThemeSynthesisMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(feedbackThemeSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving learning contract drift is reviewed without automatic adoption', async () => {
  const result = await collectFeedbackThemeSynthesisMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'learning-loop-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-upstream-learning-contract-change', sourceId: 'learning-loop-main', observedDigest: 'f'.repeat(64) }])
})

test('expired contract proof requests a local rerun only', async () => {
  const result = await collectFeedbackThemeSynthesisMaintenance({ now: () => new Date('2026-09-12T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-theme-synthesis-local.json' }])
})

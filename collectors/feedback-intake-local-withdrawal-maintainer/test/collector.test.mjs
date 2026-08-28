import assert from 'node:assert/strict'
import test from 'node:test'
import { collectFeedbackIntakeLocalWithdrawalMaintenance, feedbackIntakeLocalWithdrawalSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays current while unlink, withdrawal, sanitization boundary and proof remain current', async () => {
  const result = await collectFeedbackIntakeLocalWithdrawalMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(feedbackIntakeLocalWithdrawalSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('filesystem, withdrawal and sanitization drift remain separate proposals', async () => {
  const result = await collectFeedbackIntakeLocalWithdrawalMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => ({ id: source.id, status: 'review-required', observedDigest: source.id === 'node-filesystem-api' ? 'f'.repeat(64) : source.id === 'w3c-privacy-principles' ? 'e'.repeat(64) : 'd'.repeat(64) }),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'review-withdrawal-filesystem-semantics', sourceId: 'node-filesystem-api', observedDigest: 'f'.repeat(64) },
    { kind: 'knowledge-proposal', action: 'review-withdrawal-erasure-boundary', sourceId: 'w3c-privacy-principles', observedDigest: 'e'.repeat(64) },
    { kind: 'knowledge-proposal', action: 'review-logical-delete-sanitization-boundary', sourceId: 'nist-media-sanitization', observedDigest: 'd'.repeat(64) },
  ])
})

test('unreachable source and expired proof only request review and an isolated rerun', async () => {
  const result = await collectFeedbackIntakeLocalWithdrawalMaintenance({
    now: () => new Date('2026-09-28T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'node-filesystem-api' ? { id: source.id, status: 'unreachable', detail: 'timeout' } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'knowledge-proposal', action: 'recheck-feedback-withdrawal-source', sourceId: 'node-filesystem-api', reason: 'timeout' },
    { kind: 'verification-report', action: 'rerun-isolated-withdrawal-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-withdrawal-local.json' },
  ])
})

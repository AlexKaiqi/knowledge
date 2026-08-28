import assert from 'node:assert/strict'
import test from 'node:test'
import { consentedFeedbackIntakeSources, collectConsentedFeedbackIntakeMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays current while public standards and proof remain current', async () => {
  const result = await collectConsentedFeedbackIntakeMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(consentedFeedbackIntakeSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('semantic drift only creates a proposal', async () => {
  const result = await collectConsentedFeedbackIntakeMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'w3c-privacy-principles' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-feedback-intake-boundary-change', sourceId: 'w3c-privacy-principles', observedDigest: 'f'.repeat(64) }])
})

test('unreachable source and expired proof request review without adopting changes', async () => {
  const result = await collectConsentedFeedbackIntakeMaintenance({
    now: () => new Date('2026-09-28T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'owasp-logging-data-exclusion' ? { id: source.id, status: 'unreachable', detail: 'timeout' } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'knowledge-proposal', action: 'recheck-feedback-intake-source', sourceId: 'owasp-logging-data-exclusion', reason: 'timeout' },
    { kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/consented-feedback-intake-review-revision-local.json' },
  ])
})

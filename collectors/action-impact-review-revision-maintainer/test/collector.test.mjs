import assert from 'node:assert/strict'
import test from 'node:test'
import { actionReviewSources, collectActionImpactReviewRevisionMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest ?? 'a'.repeat(64), digestCurrent: source.acceptedDocumentDigest === undefined ? null : true, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays current while production and standards semantics remain verified', async () => {
  const result = await collectActionImpactReviewRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(actionReviewSources.length, 8)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving production drift is separate from standards review and never auto-adopted', async () => {
  const result = await collectActionImpactReviewRevisionMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'pet-assistant-core-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : source.id === 'oauth-rich-authorization' ? { id: source.id, status: 'review-required', observedDigest: 'e'.repeat(64) } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'review-production-authorization-change', sourceId: 'pet-assistant-core-main', observedDigest: 'f'.repeat(64) },
    { kind: 'knowledge-proposal', action: 'review-action-review-semantics-change', sourceId: 'oauth-rich-authorization', observedDigest: 'e'.repeat(64) },
  ])
})

test('expired proof requests an effect-free local rerun', async () => {
  const result = await collectActionImpactReviewRevisionMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/action-impact-review-revision-local.json' }])
})

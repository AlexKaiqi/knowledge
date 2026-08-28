import assert from 'node:assert/strict'
import test from 'node:test'
import { proactiveContactSources, collectProactiveContactReviewMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest ?? 'a'.repeat(64), digestCurrent: source.acceptedDocumentDigest === undefined ? null : true, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays current while policy implementations and official guidance remain current', async () => {
  const result = await collectProactiveContactReviewMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(proactiveContactSources.length, 6)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving implementation drift and official guidance drift remain separate proposals', async () => {
  const result = await collectProactiveContactReviewMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'), report: currentReport,
    sourceCheck: async (source) => source.id === 'mira-companion-policy-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : source.id === 'android-notification-control' ? { id: source.id, status: 'review-required', observedDigest: 'e'.repeat(64) } : currentSource(source),
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'review-upstream-proactive-policy-change', sourceId: 'mira-companion-policy-main', observedDigest: 'f'.repeat(64) },
    { kind: 'knowledge-proposal', action: 'review-proactive-contact-evidence-change', sourceId: 'android-notification-control', observedDigest: 'e'.repeat(64) },
  ])
})

test('expired proof requests only an effect-free local rerun', async () => {
  const result = await collectProactiveContactReviewMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/proactive-contact-review-revision-local.json' }])
})

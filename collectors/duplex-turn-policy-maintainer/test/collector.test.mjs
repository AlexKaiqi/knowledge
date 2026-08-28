import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDuplexTurnPolicyMaintenance, turnPolicySources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest ?? 'a'.repeat(64),
  digestCurrent: true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true }))
})
const currentReport = { expiresAt: '2026-09-10T06:00:00Z' }

test('maintainer stays proposal-free while four sources and verification are current', async () => {
  const result = await collectDuplexTurnPolicyMaintenance({ now: () => new Date('2026-08-27T06:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(turnPolicySources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('production main drift produces a connector proposal but is never adopted', async () => {
  const result = await collectDuplexTurnPolicyMaintenance({
    now: () => new Date('2026-08-27T06:00:00Z'),
    sourceCheck: async (source) => source.id === 'production-main-client'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-upstream-turn-semantics', sourceId: 'production-main-client', observedDigest: 'f'.repeat(64) }])
})

test('research semantic drift only proposes evidence review', async () => {
  const result = await collectDuplexTurnPolicyMaintenance({
    now: () => new Date('2026-08-27T06:00:00Z'),
    sourceCheck: async (source) => source.id === 'barge-in-problem'
      ? { id: source.id, status: 'review-required', observedDigest: 'e'.repeat(64) }
      : currentSource(source),
    report: currentReport
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-turn-policy-evidence', sourceId: 'barge-in-problem', observedDigest: 'e'.repeat(64) }])
})

test('expired verification requests only an effect-free local probe', async () => {
  const result = await collectDuplexTurnPolicyMaintenance({ now: () => new Date('2026-09-11T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/duplex-turn-policy-local.json' }])
})

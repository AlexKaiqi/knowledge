import assert from 'node:assert/strict'
import test from 'node:test'
import { behaviorSources, collectPublicStatePetBehaviorMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest,
  digestCurrent: true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-26T00:00:00Z' }

test('maintainer stays proposal-free while production semantics and local verification are current', async () => {
  const result = await collectPublicStatePetBehaviorMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.equal(behaviorSources.length, 2)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('main drift produces a connector proposal but is never adopted automatically', async () => {
  const result = await collectPublicStatePetBehaviorMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'production-main-client'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-upstream-behavior-change', sourceId: 'production-main-client', observedDigest: 'f'.repeat(64) }])
})

test('expired verification requests only a new effect-free local probe', async () => {
  const result = await collectPublicStatePetBehaviorMaintenance({
    now: () => new Date('2026-09-27T00:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/public-state-pet-behavior-local.json' }])
})

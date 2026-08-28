import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPersonaContinuityEvaluationMaintenance, personaContinuitySources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-11T00:00:00Z' }

test('current persona sources and fresh local proof remain proposal-free', async () => {
  const result = await collectPersonaContinuityEvaluationMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(personaContinuitySources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('source drift becomes a proposal and is never adopted automatically', async () => {
  const result = await collectPersonaContinuityEvaluationMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'anchorbench-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-persona-continuity-source-change', sourceId: 'anchorbench-main', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests a local rerun only', async () => {
  const result = await collectPersonaContinuityEvaluationMaintenance({ now: () => new Date('2026-09-12T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/persona-continuity-evaluation-local.json' }])
})

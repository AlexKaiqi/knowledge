import assert from 'node:assert/strict'
import test from 'node:test'
import { collectMultiTurnResponseRepetitionMaintenance, multiTurnResponseRepetitionSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-11T00:00:00Z' }

test('current sources and fresh local proof remain proposal-free', async () => {
  const result = await collectMultiTurnResponseRepetitionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(multiTurnResponseRepetitionSources.length, 5)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('source drift becomes a proposal and is never adopted automatically', async () => {
  const result = await collectMultiTurnResponseRepetitionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'han-2022-semantic-diversity' ? { id: source.id, status: 'review-required', observedDigest: 'e'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-response-repetition-source-change', sourceId: 'han-2022-semantic-diversity', observedDigest: 'e'.repeat(64) }])
})

test('expired proof requests a local rerun only', async () => {
  const result = await collectMultiTurnResponseRepetitionMaintenance({ now: () => new Date('2026-09-12T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/multi-turn-response-repetition-local.json' }])
})

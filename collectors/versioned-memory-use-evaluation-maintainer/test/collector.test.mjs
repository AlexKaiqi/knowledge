import assert from 'node:assert/strict'
import test from 'node:test'
import { collectVersionedMemoryUseEvaluationMaintenance, memoryEvaluationSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-26T07:25:55Z' }

test('maintainer stays current while four memory evaluation sources and proof remain current', async () => {
  const result = await collectVersionedMemoryUseEvaluationMaintenance({ now: () => new Date('2026-08-27T08:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(memoryEvaluationSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('research semantic drift creates only a review proposal', async () => {
  const result = await collectVersionedMemoryUseEvaluationMaintenance({ now: () => new Date('2026-08-27T08:00:00Z'), sourceCheck: async (source) => source.id === 'longmemeval' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-memory-evaluation-research-change', sourceId: 'longmemeval', observedDigest: 'f'.repeat(64) }])
})

test('expired evidence requests only an effect-free local rerun', async () => {
  const result = await collectVersionedMemoryUseEvaluationMaintenance({ now: () => new Date('2026-09-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/versioned-memory-use-evaluation-local.json' }])
})

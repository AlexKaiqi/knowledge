import assert from 'node:assert/strict'
import test from 'node:test'
import { durableMemoryReviewSources, collectDurableMemoryChangeReviewMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays current while pinned and moving production semantics agree', async () => {
  const result = await collectDurableMemoryChangeReviewMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(durableMemoryReviewSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving service drift creates connector proposal without automatic adoption', async () => {
  const result = await collectDurableMemoryChangeReviewMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'), report: currentReport,
    sourceCheck: async (source) => source.id === 'personal-knowledge-service-main' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-production-memory-semantics-change', sourceId: 'personal-knowledge-service-main', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests an effect-free local rerun', async () => {
  const result = await collectDurableMemoryChangeReviewMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/durable-memory-change-review-revision-local.json' }])
})

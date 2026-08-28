import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCurrentWorkProjectionReconciliation, currentWorkReconciliationSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: source.acceptedDocumentDigest, digestCurrent: true, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-26T11:00:00.000Z' }

test('maintainer stays current with production reconciliation semantics and fresh proof', async () => {
  const result = await collectCurrentWorkProjectionReconciliation({ now: () => new Date('2026-08-27T11:00:00.000Z'), sourceCheck: currentSource, report })
  assert.equal(currentWorkReconciliationSources.length, 6)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('production implementation drift stays separate from evidence drift', async () => {
  const result = await collectCurrentWorkProjectionReconciliation({
    now: () => new Date('2026-08-27T11:00:00.000Z'),
    sourceCheck: async (source) => ['personal-knowledge-reconciler-main', 'personal-knowledge-e2e-main'].includes(source.id) ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report,
  })
  assert.deepEqual(result.proposals.map((item) => [item.kind, item.action]), [
    ['connector-change-proposal', 'review-production-reconciliation-change'],
    ['knowledge-proposal', 'review-reconciliation-evidence-change'],
  ])
})

test('expired proof requests only another isolated local-write probe', async () => {
  const result = await collectCurrentWorkProjectionReconciliation({ now: () => new Date('2026-09-27T00:00:00.000Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/current-work-projection-reconciliation-local.json' }])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCurrentWorkProjectionMaintenance, currentWorkMaintenanceSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest,
  digestCurrent: true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-26T06:49:31.363Z' }

test('maintainer is current only with current production semantics, E2E evidence and local proof', async () => {
  const result = await collectCurrentWorkProjectionMaintenance({ now: () => new Date('2026-08-27T06:50:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(currentWorkMaintenanceSources.length, 6)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('implementation drift and E2E evidence drift remain different proposals', async () => {
  const result = await collectCurrentWorkProjectionMaintenance({
    now: () => new Date('2026-08-27T06:50:00Z'),
    sourceCheck: async (source) => source.id === 'personal-knowledge-maintainer-main' || source.id === 'personal-knowledge-e2e-main'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => [proposal.kind, proposal.action]), [
    ['connector-change-proposal', 'review-production-maintenance-change'],
    ['knowledge-proposal', 'review-maintenance-evidence-change'],
  ])
})

test('expired proof requests only another isolated local-write probe', async () => {
  const result = await collectCurrentWorkProjectionMaintenance({ now: () => new Date('2026-09-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/current-work-projection-maintenance-local.json' }])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { boundedWorkContextSources, collectBoundedWorkContextMaintenance } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest,
  digestCurrent: true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-26T06:37:55.075Z' }

test('maintainer is current only with current production projection boundaries and verification', async () => {
  const result = await collectBoundedWorkContextMaintenance({ now: () => new Date('2026-08-27T06:40:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(boundedWorkContextSources.length, 6)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('main drift proposes a connector review while pinned evidence drift stays knowledge-only', async () => {
  const result = await collectBoundedWorkContextMaintenance({
    now: () => new Date('2026-08-27T06:40:00Z'),
    sourceCheck: async (source) => source.id === 'personal-knowledge-service-main' || source.id === 'personal-knowledge-e2e-pinned'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => [proposal.kind, proposal.action]), [
    ['connector-change-proposal', 'review-production-projection-change'],
    ['knowledge-proposal', 'review-accepted-projection-evidence-change'],
  ])
})

test('expired evidence requests an effect-free local reprobe', async () => {
  const result = await collectBoundedWorkContextMaintenance({ now: () => new Date('2026-09-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/bounded-work-context-local.json' }])
})

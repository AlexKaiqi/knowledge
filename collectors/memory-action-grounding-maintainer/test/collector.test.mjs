import assert from 'node:assert/strict'
import test from 'node:test'
import { collectMemoryActionGroundingMaintenance, groundingSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest ?? 'a'.repeat(64),
  digestCurrent: source.acceptedDocumentDigest ? true : null,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-26T02:11:29.874Z' }

test('maintainer is current only with current product boundaries, research evidence and local verification', async () => {
  const result = await collectMemoryActionGroundingMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(groundingSources.length, 7)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('main implementation drift and research evidence drift remain separate proposals', async () => {
  const result = await collectMemoryActionGroundingMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'pet-assistant-main' || source.id === 'tangle-v1'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((item) => [item.kind, item.action]), [
    ['connector-change-proposal', 'review-production-boundary-change'],
    ['knowledge-proposal', 'review-grounding-evidence-change'],
  ])
})

test('expired evidence requests a new effect-free local probe without executing an action', async () => {
  const result = await collectMemoryActionGroundingMaintenance({ now: () => new Date('2026-09-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/memory-action-grounding-local.json' }])
})

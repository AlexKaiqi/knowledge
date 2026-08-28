import assert from 'node:assert/strict'
import test from 'node:test'
import { collectEvidenceBackedResearchMaintenance, researchSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest,
  digestCurrent: true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})

const currentReport = { expiresAt: '2026-09-10T00:50:01.110Z' }

test('research maintainer stays proposal-free while pinned methods and verification are current', async () => {
  const result = await collectEvidenceBackedResearchMaintenance({
    now: () => new Date('2026-08-27T01:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.equal(researchSources.length, 26)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('research maintainer proposes review but never adopts changed or unavailable methods', async () => {
  const result = await collectEvidenceBackedResearchMaintenance({
    now: () => new Date('2026-08-27T01:00:00Z'),
    sourceCheck: async (source) => source.id === 'deep-research'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : source.id === 'research-router'
        ? { id: source.id, status: 'unreachable', detail: 'request-failed' }
        : currentSource(source),
    report: currentReport,
  })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-research-method-source', 'recheck-research-method-provenance'])
  assert.equal(JSON.stringify(result).includes('install'), false)
})

test('research maintainer requests a new local probe after verification expires', async () => {
  const result = await collectEvidenceBackedResearchMaintenance({
    now: () => new Date('2026-09-11T00:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/evidence-backed-research-local.json' }])
})

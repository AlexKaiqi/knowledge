import assert from 'node:assert/strict'
import test from 'node:test'
import { collectLocalGameBuildRevisionMaintenance, gameBuildSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: source.acceptedDocumentDigest ?? 'a'.repeat(64),
  digestCurrent: source.acceptedDocumentDigest === undefined ? null : true,
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays proposal-free while primitives, platform semantics and local proof are current', async () => {
  const result = await collectLocalGameBuildRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(gameBuildSources.length, 7)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('moving upstream drift produces a connector proposal without automatic adoption', async () => {
  const result = await collectLocalGameBuildRevisionMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'social-workbench-domain-main'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-upstream-build-primitive-change', sourceId: 'social-workbench-domain-main', observedDigest: 'f'.repeat(64) }])
})

test('official semantics drift remains a knowledge proposal and expired proof requests a local rerun', async () => {
  const result = await collectLocalGameBuildRevisionMaintenance({
    now: () => new Date('2026-09-28T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'steam-steampipe-uploading'
      ? { id: source.id, status: 'review-required', observedDigest: 'e'.repeat(64) }
      : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'knowledge-proposal', action: 'review-build-semantics-change', sourceId: 'steam-steampipe-uploading', observedDigest: 'e'.repeat(64) },
    { kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/local-game-build-revision-local.json' },
  ])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamStoreAssetRevisionMaintenance, steamStoreAssetSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: 'a'.repeat(64),
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays proposal-free while official rules and local proof are current', async () => {
  const result = await collectSteamStoreAssetRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(steamStoreAssetSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('official semantic drift creates a proposal without changing connector behavior', async () => {
  const result = await collectSteamStoreAssetRevisionMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'steam-store-asset-overview' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-steam-store-asset-rule-change', sourceId: 'steam-store-asset-overview', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests a local rerun', async () => {
  const result = await collectSteamStoreAssetRevisionMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-store-asset-review-revision-local.json' }])
})

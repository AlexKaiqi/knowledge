import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamStoreDescriptionRevisionMaintenance, steamStoreDescriptionSources } from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  status: 'current',
  observedDigest: 'a'.repeat(64),
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})
const currentReport = { expiresAt: '2026-09-27T00:00:00Z' }

test('maintainer stays proposal-free while official copy rules and local proof are current', async () => {
  const result = await collectSteamStoreDescriptionRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(steamStoreDescriptionSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('official semantic drift creates a proposal without rewriting copy policy', async () => {
  const result = await collectSteamStoreDescriptionRevisionMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => source.id === 'steam-store-written-description' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-steam-store-description-rule-change', sourceId: 'steam-store-written-description', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests only an effect-free local rerun', async () => {
  const result = await collectSteamStoreDescriptionRevisionMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-store-description-review-revision-local.json' }])
})

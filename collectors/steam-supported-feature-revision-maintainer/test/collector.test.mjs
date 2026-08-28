import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamSupportedFeatureRevisionMaintenance, steamSupportedFeatureSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: '0'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-27T00:00:00Z' }

test('current official feature rules and fresh proof remain proposal-free', async () => {
  const result = await collectSteamSupportedFeatureRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(steamSupportedFeatureSources.length, 2)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('official drift creates a proposal without changing selected features', async () => {
  const result = await collectSteamSupportedFeatureRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'steam-review-process' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-steam-supported-feature-rule-change', sourceId: 'steam-review-process', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests an effect-free local rerun', async () => {
  const result = await collectSteamSupportedFeatureRevisionMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-supported-feature-review-revision-local.json' }])
})

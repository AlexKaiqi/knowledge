import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamSystemRequirementsRevisionMaintenance, systemRequirementsSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-26T07:02:24Z' }

test('maintainer stays current while platform, review and public field semantics remain current', async () => {
  const result = await collectSteamSystemRequirementsRevisionMaintenance({ now: () => new Date('2026-08-27T08:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(systemRequirementsSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('semantic drift creates only a review proposal', async () => {
  const result = await collectSteamSystemRequirementsRevisionMaintenance({
    now: () => new Date('2026-08-27T08:00:00Z'),
    sourceCheck: async (source) => source.id === 'steam-platforms' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-official-system-requirements-change', sourceId: 'steam-platforms', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests only an effect-free local rerun', async () => {
  const result = await collectSteamSystemRequirementsRevisionMaintenance({ now: () => new Date('2026-09-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-system-requirements-review-revision-local.json' }])
})

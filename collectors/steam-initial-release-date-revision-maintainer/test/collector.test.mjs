import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamInitialReleaseDateRevisionMaintenance, steamInitialReleaseDateSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-26T12:00:00.000Z' }

test('maintainer stays current while date, Coming Soon and release semantics remain current', async () => {
  const result = await collectSteamInitialReleaseDateRevisionMaintenance({ now: () => new Date('2026-08-27T12:00:00.000Z'), sourceCheck: currentSource, report })
  assert.equal(steamInitialReleaseDateSources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('official semantic drift creates only a review proposal', async () => {
  const result = await collectSteamInitialReleaseDateRevisionMaintenance({
    now: () => new Date('2026-08-27T12:00:00.000Z'),
    sourceCheck: async (source) => source.id === 'steam-release-dates' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source),
    report,
  })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'review-official-initial-release-date-change', sourceId: 'steam-release-dates', observedDigest: 'f'.repeat(64) }])
})

test('unreachable source and expired proof remain proposals without platform execution', async () => {
  const result = await collectSteamInitialReleaseDateRevisionMaintenance({
    now: () => new Date('2026-09-27T00:00:00.000Z'),
    sourceCheck: async (source) => source.id === 'steam-coming-soon' ? { id: source.id, status: 'unreachable', detail: 'timeout' } : currentSource(source),
    report,
  })
  assert.deepEqual(result.proposals, [
    { kind: 'knowledge-proposal', action: 'recheck-steam-initial-release-date-source', sourceId: 'steam-coming-soon', reason: 'timeout' },
    { kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-initial-release-date-review-revision-local.json' },
  ])
})

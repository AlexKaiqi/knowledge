import assert from 'node:assert/strict'
import test from 'node:test'
import { collectOptifeedRadarAiReadinessMaintenance } from '../src/index.mjs'

const commit = '2e0af8990de6914eefe4665bfe98f5d5c5e9e81b'
const runtime = { packageName: 'optifeed-radar', packageVersion: '0.3.0', license: 'MIT', commit, built: true }
const freshReport = { expiresAt: '2026-09-07T00:00:00Z' }

test('reports current when upstream, local runtime, and live verification are aligned', async () => {
  const result = await collectOptifeedRadarAiReadinessMaintenance({
    now: () => new Date('2026-08-31T00:00:00Z'),
    remoteHead: async () => commit,
    localRuntime: async () => runtime,
    report: freshReport,
  })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review for upstream or local runtime drift without applying it', async () => {
  const changed = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const result = await collectOptifeedRadarAiReadinessMaintenance({
    now: () => new Date('2026-08-31T00:00:00Z'),
    remoteHead: async () => changed,
    localRuntime: async () => ({ ...runtime, commit: changed }),
    report: freshReport,
  })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-optifeed-radar-upstream-change', 'review-optifeed-radar-runtime-drift'])
})

test('proposes runtime restoration and probe renewal when artifacts are missing or stale', async () => {
  const result = await collectOptifeedRadarAiReadinessMaintenance({
    now: () => new Date('2026-08-31T00:00:00Z'),
    remoteHead: async () => commit,
    localRuntime: async () => null,
    report: { expiresAt: '2026-08-30T00:00:00Z' },
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['restore-reviewed-optifeed-radar-runtime', 'rerun-live-probe'])
})

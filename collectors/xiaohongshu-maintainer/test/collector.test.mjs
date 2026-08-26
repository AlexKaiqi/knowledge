import assert from 'node:assert/strict'
import test from 'node:test'
import { collectXiaohongshuMaintenance, officialSources } from '../src/index.mjs'

test('maintainer is proposal-only and cannot promote an unverified connector', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: async () => '6fb866a7db4e3dcce8dc00a0dde07370f3b12946',
    artifactCheck: async () => [
      { id: 'xiaohongshu-mcp', status: 'present' },
      { id: 'xiaohongshu-login', status: 'present' },
    ],
    now: () => new Date('2026-08-26T09:00:00.000Z'),
  })
  assert.equal(report.mode, 'proposal-only')
  assert.equal(report.sources.length, officialSources.length)
  assert.equal(report.connector.conformance, 'candidate')
  assert.ok(report.blockers.includes('connector-not-live-verified'))
  assert.ok(report.blockers.includes('capability-not-admitted'))
  assert.equal(report.nextRequiredGate, 'explicit-live-probe-approval')
})

test('maintainer reports upstream drift for review without repinning', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: async () => 'f'.repeat(40),
    artifactCheck: async () => [],
  })
  assert.equal(report.upstream.status, 'review-required')
  assert.deepEqual(report.proposals, [{ kind: 'connector-change-proposal', action: 'audit-new-upstream-before-repin' }])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collectXiaohongshuMaintenance, evaluateRenderedSemanticObservation, officialSources } from '../src/index.mjs'

test('rendered browser observations are evaluated against reviewed semantic facts', () => {
  const source = officialSources.find((entry) => entry.id === 'share-sdk-qa')
  assert.equal(evaluateRenderedSemanticObservation(source, '现在限制了通过分享 SDK 自动填充标题和文案，已接入和新接入方都受限制。').semanticStatus, 'passed')
  assert.equal(evaluateRenderedSemanticObservation(source, '常见问题页面仍然可以打开。').semanticStatus, 'failed')
})

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
  assert.ok(report.blockers.includes('no-verified-full-route'))
  assert.ok(report.blockers.includes('capability-not-admitted'))
  assert.equal(report.accessRoutes.automaticEligible.length, 0)
  assert.equal(report.accessRoutes.upstreams.length, 4)
  assert.equal(report.nextRequiredGate, 'explicit-live-probe-approval')
})

test('maintainer reports upstream drift for review without repinning', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: async () => 'f'.repeat(40),
    artifactCheck: async () => [],
  })
  assert.equal(report.upstream.status, 'review-required')
  assert.equal(report.proposals.length, 4)
  assert.deepEqual(report.proposals[0], {
    kind: 'connector-change-proposal',
    routeId: 'creator-web-xiaohongshu-mcp',
    action: 'audit-new-upstream-before-repin',
  })
})

test('maintainer preserves an unreachable research route as a proposal instead of hiding it', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: async (repository) => {
      if (repository.includes('opencli')) throw new Error('network unavailable')
      const routeHeads = {
        'https://github.com/xpzouying/xiaohongshu-mcp.git': '6fb866a7db4e3dcce8dc00a0dde07370f3b12946',
        'https://github.com/dreammis/social-auto-upload.git': '1c66b7db4b30585bbb40c58eb0aa572ffa3cce97',
        'https://github.com/RbBtSn0w/omni-post.git': 'e690a13291d6152f4b5e4810110fe59b9c5eda47',
      }
      return routeHeads[repository]
    },
    artifactCheck: async () => [],
  })
  assert.ok(report.blockers.includes('route-upstream-unreachable:creator-web-opencli'))
  assert.deepEqual(report.proposals, [{
    kind: 'connector-change-proposal',
    routeId: 'creator-web-opencli',
    action: 'restore-upstream-observation',
  }])
})

test('maintainer proposes review when an official semantic fingerprint changes', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({
      id: source.id,
      url: source.url,
      role: source.role,
      status: 'reachable',
      fingerprintStatus: source.id === 'account-api' ? 'review-required' : 'current',
      semanticStatus: 'passed',
    }),
    upstreamHead: async (repository) => {
      const heads = {
        'https://github.com/xpzouying/xiaohongshu-mcp.git': '6fb866a7db4e3dcce8dc00a0dde07370f3b12946',
        'https://github.com/dreammis/social-auto-upload.git': '1c66b7db4b30585bbb40c58eb0aa572ffa3cce97',
        'https://github.com/chatek/opencli.git': '8dee08bc4c6329fdc807c208adb197adb21a1d7f',
        'https://github.com/RbBtSn0w/omni-post.git': 'e690a13291d6152f4b5e4810110fe59b9c5eda47',
      }
      return heads[repository]
    },
    artifactCheck: async () => [],
  })
  assert.ok(report.blockers.includes('official-source-content-changed'))
  assert.deepEqual(report.proposals, [{
    kind: 'knowledge-proposal',
    action: 'review-official-source-change',
    sourceIds: ['account-api'],
  }])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { collectXiaohongshuMaintenance, evaluateRenderedSemanticObservation, isProjectReviewDue, officialSources } from '../src/index.mjs'

const pinnedRouteHeads = {
  'https://github.com/xpzouying/xiaohongshu-mcp.git': '6fb866a7db4e3dcce8dc00a0dde07370f3b12946',
  'https://github.com/CNQQC/xhs-mcp.git': '4915580ece0b2c65c5fc777225e2945a67e300d3',
  'https://github.com/dreammis/social-auto-upload.git': '1c66b7db4b30585bbb40c58eb0aa572ffa3cce97',
  'https://github.com/white0dew/XiaohongshuSkills.git': 'ba485253e51fabe6a99916f0d378fa97884b0b75',
  'https://github.com/chatek/opencli.git': '8dee08bc4c6329fdc807c208adb197adb21a1d7f',
  'https://github.com/jackwener/xiaohongshu-cli.git': '4d63f3c0c85ccd9054fa8e96d7f761aaf2507449',
  'https://github.com/RbBtSn0w/omni-post.git': 'e690a13291d6152f4b5e4810110fe59b9c5eda47',
}

const currentRouteHead = async (repository) => pinnedRouteHeads[repository]
const currentProjectHead = async (_repository, _branch, project) => project.observedRevision

test('rendered browser observations are evaluated against reviewed semantic facts', () => {
  const source = officialSources.find((entry) => entry.id === 'share-sdk-qa')
  assert.equal(evaluateRenderedSemanticObservation(source, '现在限制了通过分享 SDK 自动填充标题和文案，已接入和新接入方都受限制。').semanticStatus, 'passed')
  assert.equal(evaluateRenderedSemanticObservation(source, '常见问题页面仍然可以打开。').semanticStatus, 'failed')
})

test('project review cadence is independent of upstream HEAD drift', () => {
  const project = { watch: { lastReviewedAt: '2026-08-01T00:00:00Z', reviewCadenceDays: 7 } }
  assert.equal(isProjectReviewDue(project, new Date('2026-08-07T23:59:59Z')), false)
  assert.equal(isProjectReviewDue(project, new Date('2026-08-08T00:00:00Z')), true)
})

test('maintainer is proposal-only and cannot promote an unverified connector', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: currentRouteHead,
    projectHead: currentProjectHead,
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
  assert.equal(report.accessRoutes.upstreams.length, 7)
  assert.equal(report.ecosystemProjects.total, 18)
  assert.ok(report.ecosystemProjects.dependencyBlocked.includes('jackwener-xiaohongshu-cli'))
  assert.equal(report.ecosystemProjects.adoptableCandidates.includes('jackwener-xiaohongshu-cli'), false)
  assert.equal(report.nextRequiredGate, 'explicit-live-probe-approval')
})

test('maintainer reports upstream drift for review without repinning', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: async () => 'f'.repeat(40),
    projectHead: currentProjectHead,
    artifactCheck: async () => [],
  })
  assert.equal(report.upstream.status, 'review-required')
  assert.equal(report.proposals.length, 7)
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
      return pinnedRouteHeads[repository]
    },
    projectHead: currentProjectHead,
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
    upstreamHead: currentRouteHead,
    projectHead: currentProjectHead,
    artifactCheck: async () => [],
  })
  assert.ok(report.blockers.includes('official-source-content-changed'))
  assert.deepEqual(report.proposals, [{
    kind: 'knowledge-proposal',
    action: 'review-official-source-change',
    sourceIds: ['account-api'],
  }])
})

test('maintainer keeps project drift separate from live route health', async () => {
  const report = await collectXiaohongshuMaintenance({
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: currentRouteHead,
    projectHead: async (_repository, _branch, project) => project.id === 'jackwener-xiaohongshu-cli' ? 'f'.repeat(40) : project.observedRevision,
    artifactCheck: async () => [],
    now: () => new Date('2026-08-27T01:00:00Z'),
  })
  assert.equal(report.accessRoutes.upstreams.every((route) => route.status === 'current'), true)
  assert.deepEqual(report.proposals, [{
    kind: 'connector-change-proposal',
    projectId: 'jackwener-xiaohongshu-cli',
    action: 'review-research-project-update',
  }])
})

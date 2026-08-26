import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { collectXiaohongshuMaintenance, discoverEcosystemProjects, evaluateRenderedSemanticObservation, isProjectReviewDue, isRelevantDiscoveryCandidate, normalizeRemoteTags, observeProjectReleaseTags, officialSources, selectDiscoveryQueries, selectReleaseWatchProjects } from '../src/index.mjs'

const projectCatalog = JSON.parse(await readFile(new URL('../projects.json', import.meta.url), 'utf8'))

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
const currentReleaseTags = async (_repository, project) => projectCatalog.releaseTagBaselines[project.id]
const currentDiscovery = async ({ query, page, perPage }) => ({
  query: { query, page, perPage, sort: 'best-match', order: 'desc' },
  coverage: { representation: 'ranked-page', totalCount: 0, returnedCount: 0, incompleteResults: false, accessibleResultCount: 0, resultWindowLimit: 1000, pageExhausted: true, ecosystemComplete: false },
  repositories: [],
  rateLimit: { resource: 'search', limit: 10, remaining: 9, resetAt: '2026-08-26T00:01:00Z' },
  conformance: { status: 'passed', assertions: [] },
})

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

test('discovery rotation covers all ten queries in five UTC days', () => {
  const queries = Array.from({ length: 10 }, (_, index) => `query-${index}`)
  const selected = new Set()
  for (let day = 0; day < 5; day += 1) {
    for (const query of selectDiscoveryQueries(queries, new Date(Date.UTC(2026, 7, 20 + day)))) selected.add(query)
  }
  assert.deepEqual([...selected].sort(), queries)
})

test('release watch rotation covers all eligible projects in five UTC days', () => {
  const declared = projectCatalog.projects.filter((project) => project.watch.reviewOn.includes('release')).map((project) => project.id)
  assert.deepEqual(Object.keys(projectCatalog.releaseTagBaselines).sort(), declared.sort())
  const selected = new Set()
  for (let day = 0; day < 5; day += 1) {
    for (const project of selectReleaseWatchProjects(projectCatalog, new Date(Date.UTC(2026, 7, 20 + day)))) selected.add(project.id)
  }
  assert.deepEqual([...selected].sort(), Object.keys(projectCatalog.releaseTagBaselines).sort())
})

test('release tag normalization prefers peeled commits for annotated tags', () => {
  const result = normalizeRemoteTags([
    `${'1'.repeat(40)}\trefs/tags/v2.0.0`,
    `${'2'.repeat(40)}\trefs/tags/v1.0.0`,
    `${'3'.repeat(40)}\trefs/tags/v1.0.0^{}`,
  ].join('\n'))
  const expected = [
    `refs/tags/v1.0.0\t${'3'.repeat(40)}`,
    `refs/tags/v2.0.0\t${'1'.repeat(40)}`,
  ].join('\n')
  assert.deepEqual(result, { tagCount: 2, digest: createHash('sha256').update(expected).digest('hex') })
})

test('release observations are serial, bounded and proposal-safe', async () => {
  const projects = selectReleaseWatchProjects(projectCatalog, new Date('2026-08-26T00:00:00Z'))
  let inFlight = 0
  let maximumInFlight = 0
  const observations = await observeProjectReleaseTags({
    projects,
    baselines: projectCatalog.releaseTagBaselines,
    releaseTags: async (_repository, project) => {
      inFlight += 1
      maximumInFlight = Math.max(maximumInFlight, inFlight)
      await Promise.resolve()
      inFlight -= 1
      if (project.id === projects[0].id) return { tagCount: 999, digest: 'f'.repeat(64) }
      return projectCatalog.releaseTagBaselines[project.id]
    },
  })
  assert.equal(observations.length, 4)
  assert.equal(maximumInFlight, 1)
  assert.equal(observations[0].status, 'review-required')
  assert.equal(observations.slice(1).every((observation) => observation.status === 'current'), true)
})

test('discovery relevance rejects xhs/rednote name collisions', () => {
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'w446108264/XhsWelcomeAnim', description: '小红书欢迎引导第二版' }), false)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'jendrikseipp/rednotebook', description: 'cross-platform journal' }), false)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'ReaJason/xhs', description: 'request wrapper' }), true)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'iFurySt/RedNote-MCP', description: 'MCP server' }), true)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'example/tool', description: '小红书搜索工具' }), true)
})

test('ecosystem discovery is serial, bounded and deduplicates unseen repositories', async () => {
  let inFlight = 0
  let maximumInFlight = 0
  let calls = 0
  const repositorySearch = async () => {
    calls += 1
    inFlight += 1
    maximumInFlight = Math.max(maximumInFlight, inFlight)
    await Promise.resolve()
    inFlight -= 1
    return {
      coverage: { representation: 'ranked-page', ecosystemComplete: false },
      rateLimit: { resource: 'search', remaining: 8 },
      repositories: [{ fullName: 'example/new-xhs-tool', url: 'https://github.com/example/new-xhs-tool', description: 'xhs tool', defaultBranch: 'main', licenseSpdx: 'MIT', archived: false, disabled: false, pushedAt: '2026-08-26T00:00:00Z' }],
      conformance: { status: 'passed', assertions: [] },
    }
  }
  const result = await discoverEcosystemProjects({ queries: ['xiaohongshu', 'xhs'], repositorySearch, projectCatalog: { projects: [] } })
  assert.equal(calls, 2)
  assert.equal(maximumInFlight, 1)
  assert.equal(result.newCandidates.length, 1)
  assert.deepEqual(result.newCandidates[0].matchedQueries, ['xiaohongshu', 'xhs'])
})

test('maintainer is proposal-only and cannot promote an unverified connector', async () => {
  const report = await collectXiaohongshuMaintenance({
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
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
  assert.equal(report.connector.capabilityConformance.find((binding) => binding.operation === 'listOwnedNotes').verificationStatus, 'current')
  assert.ok(report.blockers.includes('connector-not-live-verified'))
  assert.ok(report.blockers.includes('no-verified-full-route'))
  assert.ok(report.blockers.includes('capability-not-admitted'))
  assert.equal(report.accessRoutes.automaticEligible.length, 0)
  assert.equal(report.accessRoutes.upstreams.length, 7)
  assert.equal(report.ecosystemProjects.total, 24)
  assert.equal(report.ecosystemProjects.discovery.queries.length, 2)
  assert.equal(report.ecosystemProjects.discovery.fullCycleDays, 5)
  assert.equal(report.ecosystemProjects.discovery.newCandidates.length, 0)
  assert.ok(report.ecosystemProjects.dependencyBlocked.includes('jackwener-xiaohongshu-cli'))
  assert.equal(report.ecosystemProjects.adoptableCandidates.includes('jackwener-xiaohongshu-cli'), false)
  assert.equal(report.nextRequiredGate, 'explicit-live-probe-approval')
})

test('maintainer proposes a new probe when a verified capability report expires', async () => {
  const report = await collectXiaohongshuMaintenance({
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: currentRouteHead,
    projectHead: currentProjectHead,
    artifactCheck: async () => [],
    now: () => new Date('2026-09-03T00:00:00Z'),
  })
  assert.ok(report.blockers.includes('capability-verification-expired:listOwnedNotes'))
  assert.ok(report.proposals.some((proposal) => proposal.action === 'rerun-expired-live-probe' && proposal.capabilityRef === '/capabilities/xiaohongshu/list-owned-notes.md'))
})

test('maintainer reports upstream drift for review without repinning', async () => {
  const report = await collectXiaohongshuMaintenance({
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
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
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
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
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
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
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
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

test('maintainer proposes review for changed release tags without updating a connector', async () => {
  const observedAt = new Date('2026-08-27T01:00:00Z')
  const changedProject = selectReleaseWatchProjects(projectCatalog, observedAt)[0]
  const report = await collectXiaohongshuMaintenance({
    repositorySearch: currentDiscovery,
    releaseTags: async (_repository, project) => project.id === changedProject.id
      ? { tagCount: 999, digest: 'f'.repeat(64) }
      : currentReleaseTags(_repository, project),
    sourceCheck: async (source) => ({ ...source, status: 'reachable', httpStatus: 200 }),
    upstreamHead: currentRouteHead,
    projectHead: currentProjectHead,
    artifactCheck: async () => [],
    now: () => observedAt,
  })
  assert.ok(report.blockers.includes('ecosystem-release-tags-changed'))
  assert.deepEqual(report.proposals, [{
    kind: 'connector-change-proposal',
    projectId: changedProject.id,
    action: 'review-project-release-tags',
  }])
})

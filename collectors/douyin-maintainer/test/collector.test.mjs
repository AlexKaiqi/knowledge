import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { collectDouyinMaintenance, discoverEcosystemProjects, isRelevantDiscoveryCandidate, observeProjectReleaseTags, selectDiscoveryQueries, selectReleaseWatchProjects } from '../src/index.mjs'

const projectCatalog = JSON.parse(await readFile(new URL('../projects.json', import.meta.url), 'utf8'))

const currentDiscovery = async ({ query, page, perPage }) => ({
  query: { query, page, perPage, sort: 'best-match', order: 'desc' },
  coverage: { representation: 'ranked-page', totalCount: 0, returnedCount: 0, incompleteResults: false, accessibleResultCount: 0, resultWindowLimit: 1000, pageExhausted: true, ecosystemComplete: false },
  repositories: [],
  rateLimit: { resource: 'search', limit: 10, remaining: 9, resetAt: '2026-08-27T00:01:00Z' },
  conformance: { status: 'passed', assertions: [] },
})

const officialCurrent = async () => ({
  source: { id: 'douyin-open-platform-docs' },
  conformance: { status: 'passed', assertions: [{ id: 'capability-families', passed: true }] },
})

const currentReleaseTags = async (_repository, project) => projectCatalog.releaseTagBaselines[project.id]

test('discovery rotation covers all ten queries in five UTC days', () => {
  const queries = Array.from({ length: 10 }, (_, index) => `query-${index}`)
  const selected = new Set()
  for (let day = 0; day < 5; day += 1) {
    for (const query of selectDiscoveryQueries(queries, new Date(Date.UTC(2026, 7, 20 + day)))) selected.add(query)
  }
  assert.deepEqual([...selected].sort(), queries)
})

test('release watch baselines exactly cover declarations and rotate in four UTC days', () => {
  const declared = projectCatalog.projects.filter((project) => project.watch.reviewOn.includes('release')).map((project) => project.id)
  assert.deepEqual(Object.keys(projectCatalog.releaseTagBaselines).sort(), declared.sort())
  const selected = new Set()
  for (let day = 0; day < 4; day += 1) {
    for (const project of selectReleaseWatchProjects(projectCatalog, new Date(Date.UTC(2026, 7, 20 + day)), 4)) selected.add(project.id)
  }
  assert.deepEqual([...selected].sort(), declared.sort())
})

test('release observations are serial and detect a changed tag set', async () => {
  const projects = selectReleaseWatchProjects(projectCatalog, new Date('2026-08-27T00:00:00Z'), 4)
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
      return currentReleaseTags(_repository, project)
    },
  })
  assert.equal(maximumInFlight, 1)
  assert.equal(observations[0].status, 'review-required')
  assert.equal(observations.slice(1).every((observation) => observation.status === 'current'), true)
})

test('discovery relevance rejects TikTok-only and unrelated name collisions', () => {
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'example/tiktok-downloader', description: 'TikTok downloader' }), false)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'example/douyin-wallpaper', description: 'wallpaper collection' }), false)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'example/douyin-mcp', description: 'MCP server' }), true)
  assert.equal(isRelevantDiscoveryCandidate({ fullName: 'example/tool', description: '抖音创作者数据工具' }), true)
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
      repositories: [{ fullName: 'example/new-douyin-tool', url: 'https://github.com/example/new-douyin-tool', description: 'Douyin MCP publisher', defaultBranch: 'main', licenseSpdx: 'MIT', archived: false, disabled: false, pushedAt: '2026-08-27T00:00:00Z' }],
      conformance: { status: 'passed', assertions: [] },
    }
  }
  const result = await discoverEcosystemProjects({ queries: ['douyin mcp', '抖音 自动发布'], repositorySearch, projectCatalog: { projects: [] } })
  assert.equal(calls, 2)
  assert.equal(maximumInFlight, 1)
  assert.equal(result.newCandidates.length, 1)
  assert.deepEqual(result.newCandidates[0].matchedQueries, ['douyin mcp', '抖音 自动发布'])
})

test('maintainer keeps every route non-automatic until a real capability probe passes', async () => {
  const report = await collectDouyinMaintenance({
    now: () => new Date('2026-08-27T09:00:00Z'),
    officialReader: officialCurrent,
    projectHead: async (_repository, _branch, project) => project.observedRevision,
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
  })
  assert.equal(report.mode, 'proposal-only')
  assert.equal(report.officialOpenPlatform.status, 'current')
  assert.equal(report.ecosystemProjects.total, 24)
  assert.equal(report.ecosystemProjects.discovery.queries.length, 2)
  assert.equal(report.ecosystemProjects.discovery.fullCycleDays, 5)
  assert.equal(report.ecosystemProjects.releaseWatch.eligibleProjects, 15)
  assert.equal(report.ecosystemProjects.releaseWatch.observations.length, 4)
  assert.equal(report.ecosystemProjects.releaseWatch.fullCycleDays, 4)
  assert.deepEqual(report.accessRoutes.automaticEligible, [])
  assert.ok(report.accessRoutes.fullWriteCandidates.includes('official-open-platform'))
  assert.ok(report.accessRoutes.fullWriteCandidates.includes('creator-browser-broadcast-kit'))
  assert.ok(report.accessRoutes.fullWriteCandidates.includes('creator-browser-humanized-publisher'))
  assert.ok(report.ecosystemProjects.falseSuccessBlocked.includes('wjz-douyin-upload-mcp-skill'))
  assert.ok(report.ecosystemProjects.falseSuccessBlocked.includes('dabao-douyin-image-publisher'))
  assert.ok(report.blockers.includes('no-verified-full-route'))
  assert.equal(report.nextRequiredGate, 'implement-and-live-probe-selected-route')
})

test('maintainer reports project and route drift without repinning', async () => {
  const report = await collectDouyinMaintenance({
    now: () => new Date('2026-08-27T09:00:00Z'),
    officialReader: officialCurrent,
    projectHead: async (_repository, _branch, project) => project.id === 'chronoai-broadcast-kit' ? 'f'.repeat(40) : project.observedRevision,
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
  })
  assert.ok(report.blockers.includes('route-upstream-changed:creator-browser-broadcast-kit'))
  assert.ok(report.proposals.some((proposal) => proposal.projectId === 'chronoai-broadcast-kit' && proposal.action === 'review-research-project-update'))
})

test('maintainer turns official semantic drift into a knowledge proposal', async () => {
  const report = await collectDouyinMaintenance({
    now: () => new Date('2026-08-27T09:00:00Z'),
    officialReader: async () => ({ conformance: { status: 'review-required', assertions: [{ id: 'security-requirements', passed: false }] } }),
    projectHead: async (_repository, _branch, project) => project.observedRevision,
    repositorySearch: currentDiscovery,
    releaseTags: currentReleaseTags,
  })
  assert.ok(report.blockers.includes('official-source-semantic-change'))
  assert.deepEqual(report.proposals, [{ kind: 'knowledge-proposal', action: 'review-official-douyin-semantic-change', failures: ['security-requirements'] }])
})

test('maintainer turns release tag drift into a proposal without promoting a route', async () => {
  const observedAt = new Date('2026-08-27T09:00:00Z')
  const changedProject = selectReleaseWatchProjects(projectCatalog, observedAt, 4)[0]
  const report = await collectDouyinMaintenance({
    now: () => observedAt,
    officialReader: officialCurrent,
    projectHead: async (_repository, _branch, project) => project.observedRevision,
    repositorySearch: currentDiscovery,
    releaseTags: async (_repository, project) => project.id === changedProject.id
      ? { tagCount: 999, digest: 'f'.repeat(64) }
      : currentReleaseTags(_repository, project),
  })
  assert.ok(report.blockers.includes('ecosystem-release-tags-changed'))
  assert.ok(report.proposals.some((proposal) => proposal.projectId === changedProject.id && proposal.action === 'review-project-release-tags'))
  assert.deepEqual(report.accessRoutes.automaticEligible, [])
})

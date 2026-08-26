import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDouyinMaintenance, discoverEcosystemProjects, isRelevantDiscoveryCandidate, selectDiscoveryQueries } from '../src/index.mjs'

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

test('discovery rotation covers all ten queries in five UTC days', () => {
  const queries = Array.from({ length: 10 }, (_, index) => `query-${index}`)
  const selected = new Set()
  for (let day = 0; day < 5; day += 1) {
    for (const query of selectDiscoveryQueries(queries, new Date(Date.UTC(2026, 7, 20 + day)))) selected.add(query)
  }
  assert.deepEqual([...selected].sort(), queries)
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
  })
  assert.equal(report.mode, 'proposal-only')
  assert.equal(report.officialOpenPlatform.status, 'current')
  assert.equal(report.ecosystemProjects.total, 24)
  assert.equal(report.ecosystemProjects.discovery.queries.length, 2)
  assert.equal(report.ecosystemProjects.discovery.fullCycleDays, 5)
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
  })
  assert.ok(report.blockers.includes('official-source-semantic-change'))
  assert.deepEqual(report.proposals, [{ kind: 'knowledge-proposal', action: 'review-official-douyin-semantic-change', failures: ['security-requirements'] }])
})

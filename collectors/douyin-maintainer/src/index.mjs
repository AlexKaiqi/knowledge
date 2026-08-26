import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readDouyinOpenPlatformSurface } from '../../../connectors/douyin-open-platform-docs/src/index.mjs'
import { searchPublicRepositories } from '../../../connectors/github-public-repository-search/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const DISCOVERY_QUERIES_PER_RUN = 2
const DISCOVERY_RESULTS_PER_QUERY = 10
const DISCOVERY_CANDIDATES_PER_QUERY = 5

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

export function isProjectReviewDue(project, observedAt) {
  const lastReviewed = new Date(project.watch.lastReviewedAt).getTime()
  const cadenceMs = project.watch.reviewCadenceDays * 24 * 60 * 60 * 1000
  return observedAt.getTime() >= lastReviewed + cadenceMs
}

export function selectDiscoveryQueries(searchQueries, observedAt, count = DISCOVERY_QUERIES_PER_RUN) {
  if (!Array.isArray(searchQueries) || searchQueries.length === 0) return []
  const dayIndex = Math.floor(observedAt.getTime() / (24 * 60 * 60 * 1000))
  const start = (dayIndex * count) % searchQueries.length
  return Array.from({ length: Math.min(count, searchQueries.length) }, (_, offset) => searchQueries[(start + offset) % searchQueries.length])
}

function canonicalRepositoryUrl(url) {
  return url.replace(/\.git$/i, '').replace(/\/$/, '').toLowerCase()
}

export function isRelevantDiscoveryCandidate(repository) {
  const text = [repository.fullName, repository.description, ...(repository.topics ?? [])].filter(Boolean).join(' ').toLowerCase()
  const platformMatch = text.includes('douyin') || text.includes('抖音')
  const capabilityMatch = /\b(mcp|api|sdk|cli|client|wrapper|crawler|scraper|spider|download(?:er)?|publish|search|comment|creator|analytics|tool|toolkit|automation|auto|skill|ops|collector|rpa)\b/i.test(text)
    || /(采集|发布|搜索|视频|图文|评论|运营|下载|爬虫|接口|创作者|数据|自动化?)/.test(text)
  const exactPlatformRepositoryName = /\/(?:douyin|douyin-mcp)$/i.test(repository.fullName)
  return platformMatch && (capabilityMatch || exactPlatformRepositoryName)
}

export async function discoverEcosystemProjects({ queries, repositorySearch, projectCatalog }) {
  const known = new Set(projectCatalog.projects.map((project) => canonicalRepositoryUrl(project.repository)))
  const observations = []
  const candidates = new Map()
  for (const query of queries) {
    try {
      const result = await repositorySearch({ query, page: 1, perPage: DISCOVERY_RESULTS_PER_QUERY })
      observations.push({
        query,
        status: result.conformance.status === 'passed' ? 'current' : 'review-required',
        coverage: result.coverage,
        rateLimit: result.rateLimit,
        returnedCount: result.repositories.length,
      })
      for (const repository of result.repositories.slice(0, DISCOVERY_CANDIDATES_PER_QUERY)) {
        if (!isRelevantDiscoveryCandidate(repository)) continue
        const repositoryKey = canonicalRepositoryUrl(repository.url)
        if (known.has(repositoryKey)) continue
        const existing = candidates.get(repositoryKey)
        if (existing) {
          existing.matchedQueries.push(query)
          continue
        }
        candidates.set(repositoryKey, {
          fullName: repository.fullName,
          url: repository.url,
          description: repository.description,
          defaultBranch: repository.defaultBranch,
          licenseSpdx: repository.licenseSpdx,
          archived: repository.archived,
          disabled: repository.disabled,
          pushedAt: repository.pushedAt,
          matchedQueries: [query],
        })
      }
    } catch (error) {
      observations.push({ query, status: 'unreachable', detail: error.message })
    }
  }
  const status = observations.every((observation) => observation.status === 'current')
    ? 'current'
    : observations.every((observation) => observation.status === 'unreachable')
      ? 'unreachable'
      : 'review-required'
  return { status, queries, observations, newCandidates: [...candidates.values()] }
}

async function defaultProjectHead(repository, branch = 'main') {
  const result = await exec('git', ['ls-remote', repository, `refs/heads/${branch}`], { maxBuffer: 1024 * 1024 })
  const head = result.stdout.trim().split(/\s+/)[0] ?? ''
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('branch head was not returned')
  return head
}

async function observeProjects(projectCatalog, observedAt, projectHead) {
  const observations = []
  for (const project of projectCatalog.projects) {
    const reviewDue = isProjectReviewDue(project, observedAt)
    try {
      const currentHead = await projectHead(project.repository, project.branch, project)
      observations.push({
        id: project.id,
        status: project.status,
        roles: project.roles,
        license: project.license,
        priority: project.watch.priority,
        repository: project.repository,
        branch: project.branch,
        observedRevision: project.observedRevision,
        currentHead,
        headStatus: currentHead === project.observedRevision ? 'current' : 'review-required',
        reviewDue,
      })
    } catch (error) {
      observations.push({
        id: project.id,
        status: project.status,
        roles: project.roles,
        license: project.license,
        priority: project.watch.priority,
        repository: project.repository,
        branch: project.branch,
        observedRevision: project.observedRevision,
        currentHead: null,
        headStatus: 'unreachable',
        reviewDue,
        detail: error.message,
      })
    }
  }
  return observations
}

async function canonicalCapabilityStatus(capabilityRefs) {
  const result = []
  for (const capabilityRef of capabilityRefs) {
    const file = path.join(repositoryRoot, 'knowledge', capabilityRef.replace(/^\//, ''))
    try {
      await access(file)
      result.push({ capabilityRef, admitted: true })
    } catch {
      result.push({ capabilityRef, admitted: false })
    }
  }
  return result
}

export async function collectDouyinMaintenance({
  now = () => new Date(),
  officialReader = readDouyinOpenPlatformSurface,
  projectHead = defaultProjectHead,
  repositorySearch = searchPublicRepositories,
} = {}) {
  const observedAtDate = now()
  const observedAt = observedAtDate.toISOString()
  const projectCatalog = await readJson(path.join(repositoryRoot, 'collectors/douyin-maintainer/projects.json'))
  const routeCatalog = await readJson(path.join(repositoryRoot, 'connectors/douyin-candidate-routes/routes.json'))
  const discoveryQueries = selectDiscoveryQueries(projectCatalog.searchQueries, observedAtDate)

  const officialPromise = officialReader()
    .then((surface) => ({ status: surface.conformance.status === 'passed' ? 'current' : 'review-required', surface }))
    .catch((error) => ({ status: 'unreachable', detail: error.message }))
  const [official, projects, discovery, capabilities] = await Promise.all([
    officialPromise,
    observeProjects(projectCatalog, observedAtDate, projectHead),
    discoverEcosystemProjects({ queries: discoveryQueries, repositorySearch, projectCatalog }),
    canonicalCapabilityStatus(routeCatalog.capabilityRefs),
  ])

  const projectByRepository = new Map(projects.map((project) => [`${canonicalRepositoryUrl(project.repository)}#${project.branch}`, project]))
  const routeUpstreams = routeCatalog.routes.filter((route) => route.upstream).map((route) => {
    const project = projectByRepository.get(`${canonicalRepositoryUrl(route.upstream.repository)}#${route.upstream.branch}`)
    return {
      routeId: route.id,
      lifecycle: route.lifecycle,
      contractLevel: route.contractLevel,
      repository: route.upstream.repository,
      branch: route.upstream.branch,
      observedRevision: route.upstream.observedRevision,
      currentHead: project?.currentHead ?? null,
      status: project?.headStatus ?? 'unreachable',
      failureDomains: route.failureDomains,
    }
  })

  const blockers = []
  if (!routeCatalog.routes.some((route) => route.automaticSelectionEligible && route.lifecycle === 'verified' && route.contractLevel === 'full')) blockers.push('no-verified-full-route')
  for (const capability of capabilities.filter((entry) => !entry.admitted)) blockers.push(`capability-not-admitted:${capability.capabilityRef}`)
  if (official.status === 'unreachable') blockers.push('official-source-unreachable')
  else if (official.status !== 'current') blockers.push('official-source-semantic-change')
  if (discovery.status === 'unreachable') blockers.push('ecosystem-discovery-unreachable')
  else if (discovery.status !== 'current') blockers.push('ecosystem-discovery-review-required')
  for (const route of routeUpstreams) {
    if (route.status === 'review-required') blockers.push(`route-upstream-changed:${route.routeId}`)
    else if (route.status === 'unreachable') blockers.push(`route-upstream-unreachable:${route.routeId}`)
  }

  const proposals = []
  if (official.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', action: 'restore-official-douyin-document-access', detail: official.detail })
  else if (official.status !== 'current') proposals.push({ kind: 'knowledge-proposal', action: 'review-official-douyin-semantic-change', failures: official.surface.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
  for (const project of projects) {
    if (project.headStatus === 'review-required') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-research-project-update' })
    else if (project.headStatus === 'unreachable') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-project-observation' })
    if (project.reviewDue) proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-project-review' })
  }
  if (discovery.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', action: 'restore-ecosystem-discovery', queries: discovery.queries })
  else if (discovery.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'review-ecosystem-discovery-contract', queries: discovery.queries })
  if (discovery.newCandidates.length > 0) proposals.push({ kind: 'connector-change-proposal', action: 'triage-new-ecosystem-projects', candidates: discovery.newCandidates })

  return {
    schemaVersion: 'knowledge.maintenance-report/v1',
    subject: 'douyin',
    observedAt,
    mode: 'proposal-only',
    officialOpenPlatform: official,
    accessRoutes: {
      catalogId: routeCatalog.id,
      automaticEligible: routeCatalog.routes.filter((route) => route.automaticSelectionEligible).map((route) => route.id),
      fullWriteCandidates: routeCatalog.routes.filter((route) => route.contractLevel === 'full' && route.capabilityCoverage.some((coverage) => coverage.capabilityRef.endsWith('/publish-video-and-reconcile.md'))).map((route) => route.id),
      componentCandidates: routeCatalog.routes.filter((route) => route.contractLevel === 'component').map((route) => route.id),
      upstreams: routeUpstreams,
      researched: routeCatalog.routes.map((route) => ({ id: route.id, lifecycle: route.lifecycle, contractLevel: route.contractLevel, automaticSelectionEligible: route.automaticSelectionEligible, failureDomains: route.failureDomains })),
    },
    ecosystemProjects: {
      catalogId: projectCatalog.id,
      searchQueries: projectCatalog.searchQueries,
      total: projects.length,
      connectorRelevant: projects.filter((project) => project.roles.includes('connector-candidate') && !['excluded', 'retired'].includes(project.status)).map((project) => project.id),
      adoptableCandidates: projects.filter((project) => project.roles.includes('connector-candidate') && project.license.dependencyUse === 'allowed' && project.status === 'candidate').map((project) => project.id),
      dependencyBlocked: projects.filter((project) => project.license.dependencyUse === 'blocked').map((project) => project.id),
      researchOnly: projects.filter((project) => project.license.dependencyUse === 'research-only').map((project) => project.id),
      falseSuccessBlocked: projectCatalog.projects.filter((project) => project.failureDomains.includes('false-success')).map((project) => project.id),
      observations: projects,
      discovery: { connectorId: 'github-public-repository-search', queriesPerRun: DISCOVERY_QUERIES_PER_RUN, fullCycleDays: Math.ceil(projectCatalog.searchQueries.length / DISCOVERY_QUERIES_PER_RUN), ...discovery },
    },
    capabilities,
    blockers: [...new Set(blockers)],
    proposals,
    nextRequiredGate: 'implement-and-live-probe-selected-route',
  }
}

async function main() {
  const report = await collectDouyinMaintenance()
  const outputRoot = path.join(repositoryRoot, '.staging/douyin-maintainer')
  await mkdir(outputRoot, { recursive: true, mode: 0o700 })
  const output = path.join(outputRoot, `${report.observedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`)
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ ...report, reportPath: path.relative(repositoryRoot, output) }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { searchPublicRepositories } from '../../../connectors/github-public-repository-search/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const sourceWatchList = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/xiaohongshu-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceWatchList.sources
export const DISCOVERY_QUERIES_PER_RUN = 2
const DISCOVERY_RESULTS_PER_QUERY = 10
const DISCOVERY_CANDIDATES_PER_QUERY = 5

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function normalizeHtml(html, mode) {
  const withoutVolatileScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\b(?:nonce|integrity|crossorigin)=(?:"[^"]*"|'[^']*')/gi, '')
  if (mode === 'browser-rendered-semantic') {
    return withoutVolatileScripts
      .match(/<(?:title|meta|link)\b[^>]*>(?:[^<]*)/gi)?.join('\n').replace(/\s+/g, ' ').trim() ?? ''
  }
  return withoutVolatileScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function evaluateRenderedSemanticObservation(source, renderedText) {
  const normalized = renderedText.replace(/\s+/g, ' ').trim()
  const assertions = source.observation.assertions.map((assertion) => ({
    id: assertion.id,
    status: normalized.includes(assertion.includes) ? 'passed' : 'failed',
  }))
  return {
    semanticStatus: assertions.every((assertion) => assertion.status === 'passed') ? 'passed' : 'failed',
    semanticDigest: digest(normalized),
    assertions,
  }
}

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
  const platformMatch = text.includes('xiaohongshu') || text.includes('小红书') || /\bxhs\b/i.test(text) || /\brednote\b/i.test(text)
  const capabilityMatch = /\b(mcp|api|sdk|cli|client|wrapper|crawler|scraper|spider|download(?:er)?|publish|search|comment|creator|tool|toolkit|automation|auto|skill|ops|collector)\b/i.test(text)
    || /(采集|发布|搜索|笔记|评论|运营|下载|爬虫|接口|自动化?)/.test(text)
  const exactPlatformRepositoryName = /\/(?:xhs|xiaohongshu|rednote)$/i.test(repository.fullName)
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

async function defaultSourceCheck(source, fetchImpl, renderedObservation) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    const html = await response.text()
    const normalized = normalizeHtml(html, source.observation.mode)
    const documentDigest = digest(normalized)
    const semanticObservation = source.observation.mode === 'browser-rendered-semantic'
      ? typeof renderedObservation === 'string'
        ? evaluateRenderedSemanticObservation(source, renderedObservation)
        : {
            semanticStatus: 'browser-required',
            assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, status: 'browser-required' })),
          }
      : evaluateRenderedSemanticObservation(source, normalized)
    return {
      id: source.id,
      url: source.url,
      role: source.role,
      status: response.ok ? 'reachable' : 'changed',
      httpStatus: response.status,
      finalUrl: response.url || source.url,
      observationMode: source.observation.mode,
      documentDigest,
      fingerprintStatus: source.acceptedDocumentDigest
        ? documentDigest === source.acceptedDocumentDigest ? 'current' : 'review-required'
        : 'baseline-required',
      ...semanticObservation,
    }
  } catch (error) {
    return { id: source.id, url: source.url, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function defaultUpstreamHead(repository, branch = 'main') {
  const result = await exec('git', ['ls-remote', repository, `refs/heads/${branch}`], { maxBuffer: 1024 * 1024 })
  return result.stdout.trim().split(/\s+/)[0] ?? ''
}

async function defaultArtifactCheck(runtimeRoot) {
  const binaries = ['xiaohongshu-mcp', 'xiaohongshu-login']
  const checks = []
  for (const binary of binaries) {
    try {
      await access(path.join(runtimeRoot, 'bin', binary))
      checks.push({ id: binary, status: 'present' })
    } catch {
      checks.push({ id: binary, status: 'missing' })
    }
  }
  return checks
}

export async function collectXiaohongshuMaintenance({
  fetchImpl = fetch,
  sourceCheck = defaultSourceCheck,
  upstreamHead = defaultUpstreamHead,
  projectHead = upstreamHead,
  artifactCheck = defaultArtifactCheck,
  now = () => new Date(),
  runtimeRoot = path.join(repositoryRoot, '.runtime/xiaohongshu-browser'),
  renderedSourceObservations = {},
  repositorySearch = searchPublicRepositories,
} = {}) {
  const upstream = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/upstream.json'), 'utf8'))
  const connector = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/connector.json'), 'utf8'))
  const routeCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/routes.json'), 'utf8'))
  const projectCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/xiaohongshu-maintainer/projects.json'), 'utf8'))
  const upstreamRoutes = routeCatalog.routes.filter((route) => route.upstream)
  const observedAtDate = now()
  const discoveryQueries = selectDiscoveryQueries(projectCatalog.searchQueries, observedAtDate)
  const [sources, routeUpstreams, projects, artifacts, discovery] = await Promise.all([
    Promise.all(officialSources.map((source) => sourceCheck(source, fetchImpl, renderedSourceObservations[source.id]))),
    Promise.all(upstreamRoutes.map(async (route) => {
      try {
        const currentHead = await upstreamHead(route.upstream.repository, route.upstream.branch)
        return {
          routeId: route.id,
          lifecycle: route.lifecycle,
          contractLevel: route.contractLevel,
          failureDomains: route.failureDomains,
          repository: route.upstream.repository,
          branch: route.upstream.branch,
          observedRevision: route.upstream.observedRevision,
          currentHead,
          status: currentHead === route.upstream.observedRevision ? 'current' : 'review-required',
        }
      } catch {
        return {
          routeId: route.id,
          lifecycle: route.lifecycle,
          contractLevel: route.contractLevel,
          failureDomains: route.failureDomains,
          repository: route.upstream.repository,
          branch: route.upstream.branch,
          observedRevision: route.upstream.observedRevision,
          currentHead: null,
          status: 'unreachable',
        }
      }
    })),
    Promise.all(projectCatalog.projects.map(async (project) => {
      const reviewDue = isProjectReviewDue(project, observedAtDate)
      try {
        const currentHead = await projectHead(project.repository, project.branch, project)
        return {
          id: project.id,
          status: project.status,
          roles: project.roles,
          license: project.license,
          priority: project.watch.priority,
          repository: project.repository,
          observedRevision: project.observedRevision,
          currentHead,
          headStatus: currentHead === project.observedRevision ? 'current' : 'review-required',
          reviewDue,
        }
      } catch {
        return {
          id: project.id,
          status: project.status,
          roles: project.roles,
          license: project.license,
          priority: project.watch.priority,
          repository: project.repository,
          observedRevision: project.observedRevision,
          currentHead: null,
          headStatus: 'unreachable',
          reviewDue,
        }
      }
    })),
    artifactCheck(runtimeRoot),
    discoverEcosystemProjects({ queries: discoveryQueries, repositorySearch, projectCatalog }),
  ])
  const canonicalCapabilityPath = path.join(repositoryRoot, 'knowledge/capabilities/xiaohongshu/publish-private-note-and-observe.md')
  const canonicalReadCapabilityPath = path.join(repositoryRoot, 'knowledge/capabilities/xiaohongshu/list-owned-notes.md')
  let canonicalCapability = false
  let canonicalReadCapability = false
  try { await access(canonicalCapabilityPath); canonicalCapability = true } catch {}
  try { await access(canonicalReadCapabilityPath); canonicalReadCapability = true } catch {}
  const capabilityConformance = await Promise.all(connector.handlers.map(async (handler) => {
    const conformance = handler.conformance ?? connector.conformance
    const state = { capabilityRef: handler.capabilityRef, operation: handler.operation, status: conformance.status }
    if (conformance.status !== 'verified') return state
    try {
      const report = await readJson(path.join(repositoryRoot, 'knowledge', conformance.probeReportRef.replace(/^\//, '')))
      return {
        ...state,
        probeReportRef: conformance.probeReportRef,
        verificationExpiresAt: report.expiresAt,
        verificationStatus: Date.parse(report.expiresAt) > observedAtDate.getTime() ? 'current' : 'expired',
      }
    } catch {
      return { ...state, probeReportRef: conformance.probeReportRef, verificationStatus: 'unreadable' }
    }
  }))
  const observedAt = observedAtDate.toISOString()
  const blockers = []
  if (connector.conformance.status !== 'verified') blockers.push('connector-not-live-verified')
  if (!routeCatalog.routes.some((route) => route.automaticSelectionEligible && route.lifecycle === 'verified' && route.contractLevel === 'full')) blockers.push('no-verified-full-route')
  if (!canonicalCapability) blockers.push('capability-not-admitted')
  for (const route of routeUpstreams) {
    if (route.status === 'review-required') blockers.push(`route-upstream-changed:${route.routeId}`)
    if (route.status === 'unreachable') blockers.push(`route-upstream-unreachable:${route.routeId}`)
  }
  if (sources.some((source) => source.status !== 'reachable')) blockers.push('official-source-check-failed')
  if (sources.some((source) => source.fingerprintStatus === 'review-required')) blockers.push('official-source-content-changed')
  if (sources.some((source) => source.semanticStatus === 'failed')) blockers.push('official-source-semantic-assertion-failed')
  if (artifacts.some((artifact) => artifact.status !== 'present')) blockers.push('local-runtime-not-built')
  if (discovery.status === 'unreachable') blockers.push('ecosystem-discovery-unreachable')
  else if (discovery.status === 'review-required') blockers.push('ecosystem-discovery-review-required')
  const verificationProposals = []
  for (const binding of capabilityConformance) {
    if (binding.verificationStatus === 'expired') {
      blockers.push(`capability-verification-expired:${binding.operation}`)
      verificationProposals.push({ kind: 'verification-report', capabilityRef: binding.capabilityRef, action: 'rerun-expired-live-probe' })
    } else if (binding.verificationStatus === 'unreadable') {
      blockers.push(`capability-verification-unreadable:${binding.operation}`)
      verificationProposals.push({ kind: 'verification-report', capabilityRef: binding.capabilityRef, action: 'restore-live-verification-report' })
    }
  }
  const primaryRoute = routeUpstreams.find((route) => route.repository === upstream.repository)
  const routeProposals = routeUpstreams
    .filter((route) => route.status !== 'current')
    .map((route) => ({
      kind: 'connector-change-proposal',
      routeId: route.routeId,
      action: route.status === 'unreachable' ? 'restore-upstream-observation' : 'audit-new-upstream-before-repin',
    }))
  const sourceProposals = []
  const browserRequired = sources.filter((source) => source.semanticStatus === 'browser-required').map((source) => source.id)
  const baselineRequired = sources.filter((source) => source.fingerprintStatus === 'baseline-required').map((source) => source.id)
  const changedSources = sources.filter((source) => source.fingerprintStatus === 'review-required' || source.semanticStatus === 'failed').map((source) => source.id)
  if (browserRequired.length > 0) sourceProposals.push({ kind: 'knowledge-proposal', action: 'run-browser-semantic-observation', sourceIds: browserRequired })
  if (baselineRequired.length > 0) sourceProposals.push({ kind: 'knowledge-proposal', action: 'review-and-accept-source-baseline', sourceIds: baselineRequired })
  if (changedSources.length > 0) sourceProposals.push({ kind: 'knowledge-proposal', action: 'review-official-source-change', sourceIds: changedSources })
  const projectProposals = []
  for (const project of projects) {
    if (project.headStatus === 'review-required') {
      projectProposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-research-project-update' })
    } else if (project.headStatus === 'unreachable') {
      projectProposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-project-observation' })
    }
    if (project.reviewDue) projectProposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-project-review' })
  }
  if (discovery.status === 'unreachable') projectProposals.push({ kind: 'connector-change-proposal', action: 'restore-ecosystem-discovery', queries: discovery.queries })
  else if (discovery.status === 'review-required') projectProposals.push({ kind: 'connector-change-proposal', action: 'review-ecosystem-discovery-contract', queries: discovery.queries })
  if (discovery.newCandidates.length > 0) projectProposals.push({ kind: 'connector-change-proposal', action: 'triage-new-ecosystem-projects', candidates: discovery.newCandidates })
  return {
    schemaVersion: 'knowledge.maintenance-report/v1',
    subject: 'xiaohongshu',
    observedAt,
    mode: 'proposal-only',
    sources,
    upstream: {
      repository: upstream.repository,
      pinnedCommit: upstream.commit,
      currentHead: primaryRoute?.currentHead ?? null,
      status: primaryRoute?.status ?? 'unreachable',
    },
    accessRoutes: {
      catalogId: routeCatalog.id,
      automaticEligible: routeCatalog.routes.filter((route) => route.automaticSelectionEligible).map((route) => route.id),
      researched: routeCatalog.routes.map((route) => ({
        id: route.id,
        lifecycle: route.lifecycle,
        contractLevel: route.contractLevel,
        automaticSelectionEligible: route.automaticSelectionEligible,
        failureDomains: route.failureDomains,
      })),
      upstreams: routeUpstreams,
    },
    ecosystemProjects: {
      catalogId: projectCatalog.id,
      searchQueries: projectCatalog.searchQueries,
      total: projects.length,
      connectorRelevant: projects.filter((project) => project.roles.includes('connector-candidate') && project.status !== 'excluded' && project.status !== 'retired').map((project) => project.id),
      adoptableCandidates: projects.filter((project) => project.roles.includes('connector-candidate') && project.license.dependencyUse === 'allowed' && ['candidate', 'researching'].includes(project.status)).map((project) => project.id),
      dependencyBlocked: projects.filter((project) => project.license.dependencyUse === 'blocked').map((project) => project.id),
      researchOnly: projects.filter((project) => project.license.dependencyUse === 'research-only').map((project) => project.id),
      observations: projects,
      discovery: {
        connectorId: 'github-public-repository-search',
        queriesPerRun: DISCOVERY_QUERIES_PER_RUN,
        fullCycleDays: Math.ceil(projectCatalog.searchQueries.length / DISCOVERY_QUERIES_PER_RUN),
        ...discovery,
      },
    },
    connector: { id: connector.id, conformance: connector.conformance.status, capabilityConformance, artifacts },
    canonicalCapability,
    canonicalReadCapability,
    blockers: [...new Set(blockers)],
    proposals: [...routeProposals, ...sourceProposals, ...projectProposals, ...verificationProposals],
    nextRequiredGate: connector.conformance.status === 'verified' ? 'none' : 'explicit-live-probe-approval',
  }
}

async function main() {
  const report = await collectXiaohongshuMaintenance()
  const outputRoot = path.join(repositoryRoot, '.staging/xiaohongshu-maintainer')
  await mkdir(outputRoot, { recursive: true, mode: 0o700 })
  const filename = `${report.observedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`
  const output = path.join(outputRoot, filename)
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ ...report, reportPath: path.relative(repositoryRoot, output) }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const sourceWatchList = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/xiaohongshu-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceWatchList.sources

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
} = {}) {
  const upstream = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/upstream.json'), 'utf8'))
  const connector = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/connector.json'), 'utf8'))
  const routeCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/routes.json'), 'utf8'))
  const projectCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/xiaohongshu-maintainer/projects.json'), 'utf8'))
  const upstreamRoutes = routeCatalog.routes.filter((route) => route.upstream)
  const observedAtDate = now()
  const [sources, routeUpstreams, projects, artifacts] = await Promise.all([
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
  ])
  const canonicalCapabilityPath = path.join(repositoryRoot, 'knowledge/capabilities/xiaohongshu/publish-private-note-and-observe.md')
  let canonicalCapability = false
  try { await access(canonicalCapabilityPath); canonicalCapability = true } catch {}
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
    },
    connector: { id: connector.id, conformance: connector.conformance.status, artifacts },
    canonicalCapability,
    blockers: [...new Set(blockers)],
    proposals: [...routeProposals, ...sourceProposals, ...projectProposals],
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

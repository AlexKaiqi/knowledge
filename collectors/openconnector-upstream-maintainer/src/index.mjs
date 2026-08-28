import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFile = promisify(execFileCallback)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/openconnector-upstream-maintainer/sources.json'), 'utf8'))
export const projectCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/openconnector-upstream-maintainer/projects.json'), 'utf8'))
export const upstreamSources = sourceCatalog.sources

const digest = (value) => createHash('sha256').update(value).digest('hex')

function normalizeDocument(source, mode) {
  const semanticSource = mode === 'static-html-semantic'
    ? source
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
    : source
  return semanticSource
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function checkUpstreamSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000) })
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = normalizeDocument(await response.text(), source.observation.mode)
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(text)
    const digestCurrent = source.acceptedDocumentDigest ? observedDigest === source.acceptedDocumentDigest : null
    return { id: source.id, role: source.role, status: assertions.every((assertion) => assertion.passed) && digestCurrent !== false ? 'current' : 'review-required', observedDigest, digestCurrent, assertions }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

export async function readGitHead(repository, branch) {
  const result = await execFile('git', ['ls-remote', repository, `refs/heads/${branch}`], { timeout: 20_000, maxBuffer: 1_048_576 })
  const match = result.stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\//)
  if (!match) throw new Error(`branch ${branch} was not resolved`)
  return match[1]
}

export async function readGitTagState(repository) {
  const result = await execFile('git', ['ls-remote', '--tags', repository], { timeout: 20_000, maxBuffer: 2_097_152 })
  const refs = new Map()
  for (const line of result.stdout.trim().split('\n').filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+?)(\^\{\})?$/)
    if (!match) continue
    const [, sha, name, peeled] = match
    if (peeled || !refs.has(name)) refs.set(name, sha)
  }
  const normalized = [...refs.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, sha]) => `refs/tags/${name}\t${sha}`).join('\n')
  return { tagCount: refs.size, digest: digest(normalized) }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/public-social-content-search/report.json'), 'utf8')) } catch { return null }
}

function sourceDriftAction(role) {
  if (role === 'upstream-security-contract') return 'review-openconnector-security-contract'
  if (role === 'upstream-runtime-contract' || role === 'upstream-action-contract') return 'review-openconnector-action-runtime-contract'
  if (role === 'managed-route-pricing') return 'review-oomol-managed-route-pricing'
  if (role === 'managed-route-surface') return 'review-oomol-managed-social-research-surface'
  if (role === 'same-name-project-status') return 'reassess-openconnector-dev-implementation-status'
  return 'review-openconnector-verification-contract'
}

export async function collectOpenConnectorUpstreamMaintenance({
  now = () => new Date(),
  sourceCheck = checkUpstreamSource,
  headReader = readGitHead,
  tagReader = readGitTagState,
  report,
} = {}) {
  const observedAt = now()
  const proposals = []
  const sources = []
  for (const source of upstreamSources) {
    const observation = await sourceCheck(source)
    sources.push(observation)
    if (observation.status === 'review-required') {
      proposals.push({ kind: 'connector-change-proposal', action: sourceDriftAction(source.role), sourceId: source.id, failures: observation.assertions?.filter((item) => !item.passed).map((item) => item.id) ?? [] })
    } else if (observation.status === 'unreachable') {
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-openconnector-source-observation', sourceId: source.id, reason: observation.detail ?? `HTTP_${observation.httpStatus}` })
    }
  }

  const projects = []
  for (const project of projectCatalog.projects) {
    try {
      const currentHead = await headReader(project.repository, project.branch)
      const status = currentHead === project.observedRevision ? 'current' : 'review-required'
      projects.push({ id: project.id, observedRevision: project.observedRevision, currentHead, status })
      if (status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'audit-openconnector-project-head-change', projectId: project.id, previous: project.observedRevision, current: currentHead })
    } catch (error) {
      projects.push({ id: project.id, observedRevision: project.observedRevision, currentHead: null, status: 'unreachable' })
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-openconnector-project-observation', projectId: project.id, reason: error.message })
    }
  }

  const releases = []
  for (const project of projectCatalog.projects.filter((entry) => projectCatalog.releaseTagBaselines?.[entry.id])) {
    const baseline = projectCatalog.releaseTagBaselines[project.id]
    try {
      const current = await tagReader(project.repository)
      const status = current.tagCount === baseline.tagCount && current.digest === baseline.digest ? 'current' : 'review-required'
      releases.push({ projectId: project.id, baseline, current, status })
      if (status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'audit-openconnector-release-tag-change', projectId: project.id, previous: baseline, current })
    } catch (error) {
      releases.push({ projectId: project.id, baseline, current: null, status: 'unreachable' })
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-openconnector-release-observation', projectId: project.id, reason: error.message })
    }
  }

  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-openconnector-public-social-search-probe',
      probeDefinitionRef: 'repo:/probes/definitions/openconnector-public-social-search-live.json',
      requires: ['provider-and-platform-terms-review', 'content-use-determination', 'encrypted-loopback-runtime', 'scoped-tikhub-connection', 'scoped-runtime-token', 'opaque-probe-identity', 'fixed-query-approval', 'maximum-usd-one-spend-approval'],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-openconnector-public-social-search-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-openconnector-public-social-search-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/openconnector-public-social-search-live.json' })
  }

  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, projects, releases, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectOpenConnectorUpstreamMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

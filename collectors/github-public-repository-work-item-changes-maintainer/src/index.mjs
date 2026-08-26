import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  GitHubPublicRepositoryWorkItemChangesError,
  listPublicRepositoryWorkItemChanges,
} from '../../../connectors/github-public-repository-work-item-changes/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
export const FIXTURE_INPUT = Object.freeze({
  owner: 'tamnd',
  repository: 'xiaohongshu-cli',
  checkpoint: { updatedAt: '2026-08-19T02:50:18.000Z', seenItemDigests: [] },
  maxItems: 100,
})
export const FIXTURE_NUMBER = 18

function normalizeHtml(source) {
  return source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '"').replace(/&#x27;|&#39;/gi, "'").replace(/\s+/g, ' ').trim()
}

async function defaultSourceCheck(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', headers: { accept: 'text/html', 'user-agent': 'dsh-knowledge-catalog/0.1' }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('text/html')) return { id: source.id, status: 'unreachable', detail: 'unsupported-content-type' }
    const declared = response.headers.get('content-length')
    if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const normalized = normalizeHtml(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: normalized.toLowerCase().includes(assertion.includes.toLowerCase()) }))
    return { id: source.id, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', semanticDigest: createHash('sha256').update(normalized).digest('hex'), assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function defaultProjectHead(repository, branch) {
  const result = await exec('git', ['ls-remote', repository, `refs/heads/${branch}`], { maxBuffer: 1024 * 1024 })
  const head = result.stdout.trim().split(/\s+/)[0] ?? ''
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('project branch head was not returned')
  return head
}

function reviewDue(project, at) {
  return at.getTime() >= Date.parse(project.watch.lastReviewedAt) + project.watch.reviewCadenceDays * 24 * 60 * 60 * 1000
}

async function accepted() {
  try {
    const [snapshot, report] = await Promise.all([
      readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-work-item-changes/snapshot.json'), 'utf8').then(JSON.parse),
      readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-work-item-changes/report.json'), 'utf8').then(JSON.parse),
    ])
    return { snapshot, report }
  } catch { return { snapshot: null, report: null } }
}

export async function collectGitHubWorkItemChangesMaintenance({
  now = () => new Date(), reader = listPublicRepositoryWorkItemChanges, sourceCheck = defaultSourceCheck, projectHead = defaultProjectHead,
  fetchImpl = fetch, acceptedState, sourceWatchList, projectCatalog,
} = {}) {
  const observedAt = now()
  const sourcesDefinition = sourceWatchList ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/github-public-repository-work-item-changes-maintainer/sources.json'), 'utf8'))
  const catalog = projectCatalog ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/github-public-repository-work-item-changes-maintainer/projects.json'), 'utf8'))
  const sources = []
  for (const source of sourcesDefinition.sources) sources.push(await sourceCheck(source, fetchImpl))
  const projects = []
  for (const project of catalog.projects) {
    try {
      const currentHead = await projectHead(project.repository, project.branch, project)
      projects.push({ id: project.id, observedRevision: project.observedRevision, currentHead, status: currentHead === project.observedRevision ? 'current' : 'review-required', reviewDue: reviewDue(project, observedAt) })
    } catch (error) {
      projects.push({ id: project.id, observedRevision: project.observedRevision, currentHead: null, status: 'unreachable', reviewDue: reviewDue(project, observedAt), detail: error.message })
    }
  }
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', sourceId: source.id, action: 'review-github-work-item-contract-change' })
    else if (source.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', sourceId: source.id, action: 'restore-github-work-item-contract-observation' })
  }
  for (const project of projects) {
    if (project.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-github-work-item-upstream-change' })
    else if (project.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-github-work-item-upstream-observation' })
    if (project.reviewDue) proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-github-work-item-upstream-review' })
  }
  const state = acceptedState ?? await accepted()
  try {
    const current = await reader(FIXTURE_INPUT)
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'review-github-work-item-connector-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    if (!current.coverage.complete) proposals.push({ kind: 'connector-change-proposal', action: 'expand-github-work-item-fixture-budget', reason: current.coverage.truncationReason })
    if (!current.items.some((item) => item.number === FIXTURE_NUMBER && item.kind === 'issue')) proposals.push({ kind: 'knowledge-proposal', action: 'replace-github-work-item-fixture' })
    if (!state.snapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-github-work-item-window-baseline' })
    else if (current.windowDigest !== state.snapshot.windowDigest) proposals.push({ kind: 'knowledge-proposal', action: 'review-github-work-item-window-change', previousDigest: state.snapshot.windowDigest, currentDigest: current.windowDigest })
    if (!state.report || Date.parse(state.report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-work-item-changes-live.json' })
    return { observedAt: observedAt.toISOString(), status: proposals.length ? 'review-required' : 'current', proposals, current, sources, projects }
  } catch (error) {
    if (error instanceof GitHubPublicRepositoryWorkItemChangesError && error.code === 'rate-limited') {
      proposals.push({ kind: 'verification-report', action: 'rerun-after-core-rate-limit', ...(error.retryAt ? { notBefore: error.retryAt } : {}) })
      return { observedAt: observedAt.toISOString(), status: proposals.some((proposal) => proposal.kind === 'connector-change-proposal') ? 'review-required' : 'deferred', proposals, sources, projects }
    }
    if (error instanceof GitHubPublicRepositoryWorkItemChangesError && error.code === 'repository-not-found') {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-or-replace-github-work-item-fixture' })
      return { observedAt: observedAt.toISOString(), status: 'review-required', proposals, sources, projects }
    }
    proposals.push({ kind: 'connector-change-proposal', action: 'restore-github-work-item-access', detail: error.message })
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals, sources, projects }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGitHubWorkItemChangesMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

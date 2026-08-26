import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readRegisteredPublicFeed, WebFeedReaderError } from '../../../connectors/web-feed-reader/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
export const FIXTURE_INPUT = Object.freeze({ feedId: 'nodejs-releases', limit: 10 })

function normalizeDocument(source, contentType) {
  const withoutActive = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  return (contentType.includes('html') ? withoutActive.replace(/<[^>]+>/g, ' ') : withoutActive)
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim()
}

async function defaultSourceCheck(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', headers: { accept: 'text/html, text/plain;q=0.9', 'user-agent': 'dsh-knowledge-catalog/0.1' }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return { id: source.id, status: 'unreachable', detail: 'unsupported-content-type' }
    const declared = response.headers.get('content-length')
    if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const normalized = normalizeDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytes), contentType)
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: normalized.includes(assertion.includes) }))
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

async function observeProjects(projects, at, projectHead) {
  const observations = []
  for (const project of projects) {
    try {
      const currentHead = await projectHead(project.repository, project.branch, project)
      observations.push({ id: project.id, observedRevision: project.observedRevision, currentHead, status: currentHead === project.observedRevision ? 'current' : 'review-required', reviewDue: reviewDue(project, at) })
    } catch (error) {
      observations.push({ id: project.id, observedRevision: project.observedRevision, currentHead: null, status: 'unreachable', reviewDue: reviewDue(project, at), detail: error.message })
    }
  }
  return observations
}

async function accepted() {
  try {
    const [snapshot, report] = await Promise.all([
      readFile(path.join(repositoryRoot, 'knowledge/verifications/web-feeds/nodejs-releases/snapshot.json'), 'utf8').then(JSON.parse),
      readFile(path.join(repositoryRoot, 'knowledge/verifications/web-feeds/nodejs-releases/report.json'), 'utf8').then(JSON.parse),
    ])
    return { snapshot, report }
  } catch { return { snapshot: null, report: null } }
}

export async function collectWebFeedReaderMaintenance({
  now = () => new Date(), reader = readRegisteredPublicFeed, sourceCheck = defaultSourceCheck, projectHead = defaultProjectHead, fetchImpl = fetch,
  acceptedState, sourceWatchList, projectCatalog,
} = {}) {
  const observedAt = now()
  const sourcesDefinition = sourceWatchList ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/web-feed-reader-maintainer/sources.json'), 'utf8'))
  const catalog = projectCatalog ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/web-feed-reader-maintainer/projects.json'), 'utf8'))
  const sources = []
  for (const source of sourcesDefinition.sources) sources.push(await sourceCheck(source, fetchImpl))
  const projects = await observeProjects(catalog.projects, observedAt, projectHead)
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', sourceId: source.id, action: 'review-feed-standard-semantic-change' })
    else if (source.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', sourceId: source.id, action: 'restore-feed-standard-observation' })
  }
  for (const project of projects) {
    if (project.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-feed-upstream-change' })
    else if (project.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-feed-upstream-observation' })
    if (project.reviewDue) proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-feed-upstream-review' })
  }
  const state = acceptedState ?? await accepted()
  try {
    const current = await reader(FIXTURE_INPUT)
    let feedChange = { classification: 'unchanged', documentChanged: false }
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'review-web-feed-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    if (!state.snapshot) {
      feedChange = { classification: 'baseline-missing', documentChanged: null }
      proposals.push({ kind: 'knowledge-proposal', action: 'establish-nodejs-release-feed-baseline' })
    } else if (current.feed.feedDigest !== state.snapshot.feed.feedDigest) {
      feedChange = { classification: 'semantic-change', documentChanged: current.feed.documentSha256 !== state.snapshot.feed.documentSha256 }
      proposals.push({ kind: 'knowledge-proposal', action: 'review-nodejs-release-feed-change', previousFeedDigest: state.snapshot.feed.feedDigest, currentFeedDigest: current.feed.feedDigest })
    } else if (current.feed.documentSha256 !== state.snapshot.feed.documentSha256) {
      // Raw XML changes on every Node.js site rebuild because lastBuildDate is
      // regenerated. Preserve that observation without creating a daily false
      // proposal when the normalized feed identity and entries are unchanged.
      feedChange = { classification: 'document-only', documentChanged: true, action: 'observe-without-proposal' }
    }
    if (!state.report || Date.parse(state.report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/web-feed-reader-nodejs-releases-live.json' })
    return { observedAt: observedAt.toISOString(), status: proposals.length ? 'review-required' : 'current', proposals, feedChange, current, sources, projects }
  } catch (error) {
    if (error instanceof WebFeedReaderError && error.code === 'rate-limited') {
      proposals.push({ kind: 'verification-report', action: 'rerun-after-rate-limit', ...(error.retryAt ? { notBefore: error.retryAt } : {}) })
      return { observedAt: observedAt.toISOString(), status: proposals.some((proposal) => proposal.kind === 'connector-change-proposal') ? 'review-required' : 'deferred', proposals, sources, projects }
    }
    if (error instanceof WebFeedReaderError && error.code === 'feed-not-found') {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-or-retire-nodejs-release-feed' })
      return { observedAt: observedAt.toISOString(), status: 'review-required', proposals, sources, projects }
    }
    proposals.push({ kind: 'connector-change-proposal', action: 'restore-registered-feed-access', detail: error.message })
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals, sources, projects }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectWebFeedReaderMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

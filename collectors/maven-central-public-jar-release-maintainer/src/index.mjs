import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  MavenCentralPublicJarReleaseError,
  readPublicJarReleaseEvidence,
} from '../../../connectors/maven-central-public-jar-release/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
export const FIXTURE_INPUT = Object.freeze({ groupId: 'junit', artifactId: 'junit', version: '4.13.2' })

function normalizeHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function defaultSourceCheck(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, {
      method: 'GET',
      headers: { accept: 'text/html', 'user-agent': 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)' },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('text/html')) return { id: source.id, status: 'unreachable', detail: 'non-html-response' }
    const declared = response.headers.get('content-length')
    if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_SOURCE_BYTES) return { id: source.id, status: 'unreachable', detail: 'response-budget-exceeded' }
    const normalized = normalizeHtml(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: normalized.includes(assertion.includes) }))
    return {
      id: source.id,
      status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required',
      semanticDigest: createHash('sha256').update(normalized).digest('hex'),
      assertions,
    }
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

function reviewDue(project, observedAt) {
  return observedAt.getTime() >= Date.parse(project.watch.lastReviewedAt) + project.watch.reviewCadenceDays * 24 * 60 * 60 * 1000
}

async function observeProjects(projects, observedAt, projectHead) {
  const observations = []
  for (const project of projects) {
    try {
      const currentHead = await projectHead(project.repository, project.branch, project)
      observations.push({ id: project.id, observedRevision: project.observedRevision, currentHead, status: currentHead === project.observedRevision ? 'current' : 'review-required', reviewDue: reviewDue(project, observedAt) })
    } catch (error) {
      observations.push({ id: project.id, observedRevision: project.observedRevision, currentHead: null, status: 'unreachable', reviewDue: reviewDue(project, observedAt), detail: error.message })
    }
  }
  return observations
}

function stableRelease(result) {
  const release = result?.release
  if (!release) return null
  return {
    gav: release.gav,
    packaging: release.packaging,
    repositoryPath: release.repositoryPath,
    pomModelVersion: release.pomModelVersion,
    pomCoordinatesVerified: release.pomCoordinatesVerified,
    fileCount: release.fileCount,
    totalPayloadBytes: release.totalPayloadBytes,
    files: release.files.map(({ role, fileName, sizeBytes, sha1, sha256, checksumSource }) => ({ role, fileName, sizeBytes, sha1, sha256, checksumSource })),
    signaturePresent: release.signaturePresent,
    signatureCryptographicallyVerified: release.signatureCryptographicallyVerified,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/maven-central/public-jar-release/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/maven-central/public-jar-release/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectMavenCentralPublicJarReleaseMaintenance({
  now = () => new Date(),
  reader = readPublicJarReleaseEvidence,
  sourceCheck = defaultSourceCheck,
  projectHead = defaultProjectHead,
  fetchImpl = fetch,
  acceptedState,
  sourceWatchList,
  projectCatalog,
} = {}) {
  const observedAt = now()
  const sourcesDefinition = sourceWatchList ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/maven-central-public-jar-release-maintainer/sources.json'), 'utf8'))
  const catalog = projectCatalog ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/maven-central-public-jar-release-maintainer/projects.json'), 'utf8'))
  const sources = []
  for (const source of sourcesDefinition.sources) sources.push(await sourceCheck(source, fetchImpl))
  const projects = await observeProjects(catalog.projects, observedAt, projectHead)
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', sourceId: source.id, action: 'review-official-source-semantic-change' })
    else if (source.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', sourceId: source.id, action: 'restore-official-source-observation' })
  }
  for (const project of projects) {
    if (project.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-upstream-project-change' })
    else if (project.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-upstream-project-observation' })
    if (project.reviewDue) proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-upstream-project-review' })
  }
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(FIXTURE_INPUT)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-maven-central-release-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-maven-central-release-baseline' })
    else if (JSON.stringify(stableRelease(current)) !== JSON.stringify(stableRelease(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-maven-central-release-change', previous: stableRelease(acceptedSnapshot), current: stableRelease(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/maven-central-public-jar-release-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current, sources, projects }
  } catch (error) {
    if (error instanceof MavenCentralPublicJarReleaseError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) {
      proposals.push({ kind: 'verification-report', action: error.code === 'rate-limited' ? 'rerun-after-rate-limit' : 'review-maven-central-access-policy', reason: error.code, phase: error.phase })
      return { observedAt: observedAt.toISOString(), status: proposals.some((proposal) => proposal.kind === 'connector-change-proposal') ? 'review-required' : 'deferred', proposals, sources, projects }
    }
    if (error instanceof MavenCentralPublicJarReleaseError && error.code === 'not-found') {
      proposals.push({ kind: 'knowledge-proposal', action: 'replace-or-review-maven-central-fixture', reason: error.code, phase: error.phase })
      return { observedAt: observedAt.toISOString(), status: 'review-required', proposals, sources, projects }
    }
    proposals.push({ kind: 'connector-change-proposal', action: 'restore-maven-central-release-access', detail: error.message })
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals, sources, projects }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectMavenCentralPublicJarReleaseMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  DockerHubPublicImageManifestError,
  readPublicImageManifestByDigest,
} from '../../../connectors/docker-hub-public-image-manifest/src/index.mjs'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const FIXTURE_INPUT = Object.freeze({
  repository: 'library/alpine',
  manifestDigest: 'sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d',
})

function stableManifest(result) {
  const manifest = result?.manifest
  if (!manifest) return null
  return {
    repository: manifest.repository,
    digest: manifest.digest,
    kind: manifest.kind,
    schemaVersion: manifest.schemaVersion,
    mediaType: manifest.mediaType,
    bodySizeBytes: manifest.bodySizeBytes,
    descriptorCount: manifest.descriptorCount,
    declaredReferencedBytes: manifest.declaredReferencedBytes,
    descriptorSetDigest: manifest.descriptorSetDigest,
  }
}

function reviewDue(project, observedAt) {
  return observedAt.getTime() >= Date.parse(project.watch.lastReviewedAt) + project.watch.reviewCadenceDays * 24 * 60 * 60 * 1000
}

async function defaultProjectHead(repository, branch) {
  const result = await exec('git', ['ls-remote', repository, `refs/heads/${branch}`], { maxBuffer: 1024 * 1024 })
  const head = result.stdout.trim().split(/\s+/)[0] ?? ''
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('project branch head was not returned')
  return head
}

async function observeProjects(projects, observedAt, projectHead) {
  const observations = []
  for (const project of projects) {
    try {
      const currentHead = await projectHead(project.repository, project.branch, project)
      observations.push({
        id: project.id,
        observedRevision: project.observedRevision,
        currentHead,
        status: currentHead === project.observedRevision ? 'current' : 'review-required',
        reviewDue: reviewDue(project, observedAt),
      })
    } catch (error) {
      observations.push({ id: project.id, observedRevision: project.observedRevision, currentHead: null, status: 'unreachable', reviewDue: reviewDue(project, observedAt), detail: error.message })
    }
  }
  return observations
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/docker-hub/public-image-manifest/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/docker-hub/public-image-manifest/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectDockerHubPublicImageManifestMaintenance({
  now = () => new Date(),
  reader = readPublicImageManifestByDigest,
  projectHead = defaultProjectHead,
  acceptedState,
  projectCatalog,
} = {}) {
  const observedAt = now()
  const catalog = projectCatalog ?? JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/docker-hub-public-image-manifest-maintainer/projects.json'), 'utf8'))
  const projects = await observeProjects(catalog.projects, observedAt, projectHead)
  const proposals = []
  for (const project of projects) {
    if (project.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'review-upstream-project-change' })
    else if (project.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'restore-upstream-project-observation' })
    if (project.reviewDue) proposals.push({ kind: 'connector-change-proposal', projectId: project.id, action: 'scheduled-upstream-project-review' })
  }
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(FIXTURE_INPUT)
    if (current.conformance.status !== 'passed') {
      proposals.push({
        kind: 'connector-change-proposal',
        action: 'review-docker-hub-manifest-contract',
        failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-docker-hub-manifest-baseline' })
    else if (JSON.stringify(stableManifest(current)) !== JSON.stringify(stableManifest(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-docker-hub-manifest-change', previous: stableManifest(acceptedSnapshot), current: stableManifest(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/docker-hub-public-image-manifest-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current, projects }
  } catch (error) {
    if (error instanceof DockerHubPublicImageManifestError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) {
      proposals.push({ kind: 'verification-report', action: error.code === 'rate-limited' ? 'rerun-after-pull-budget-recovers' : 'review-docker-hub-access-policy', reason: error.code })
      return { observedAt: observedAt.toISOString(), status: proposals.some((proposal) => proposal.kind === 'connector-change-proposal') ? 'review-required' : 'deferred', proposals, projects }
    }
    if (error instanceof DockerHubPublicImageManifestError && error.code === 'not-found') {
      proposals.push({ kind: 'knowledge-proposal', action: 'replace-or-review-docker-hub-manifest-fixture', reason: error.code })
      return { observedAt: observedAt.toISOString(), status: 'review-required', proposals, projects }
    }
    proposals.push({ kind: 'connector-change-proposal', action: 'restore-docker-hub-manifest-access', detail: error.message })
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals, projects }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectDockerHubPublicImageManifestMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

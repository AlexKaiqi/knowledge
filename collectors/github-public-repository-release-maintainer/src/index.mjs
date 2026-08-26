import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { GitHubPublicRepositoryReleaseError, readPublicRepositoryReleaseByTag } from '../../../connectors/github-public-repository-release/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { owner: 'JoeanAmier', repository: 'XHS-Downloader', tagName: '2.7' }

function stableRelease(result) {
  if (!result?.release) return null
  return {
    tagName: result.release.tagName,
    targetCommitish: result.release.targetCommitish,
    name: result.release.name,
    prerelease: result.release.prerelease,
    immutable: result.release.immutable,
    createdAt: result.release.createdAt,
    publishedAt: result.release.publishedAt,
    url: result.release.url,
    notesSha256: result.release.notes.sha256,
    assetCoverage: result.release.assetCoverage,
    assets: result.release.assets,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-release/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-release/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectGitHubPublicRepositoryReleaseMaintenance({ now = () => new Date(), reader = readPublicRepositoryReleaseByTag, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({
        kind: 'connector-change-proposal',
        action: 'review-github-release-contract',
        failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-github-release-baseline' })
    else if (JSON.stringify(stableRelease(current)) !== JSON.stringify(stableRelease(acceptedSnapshot))) {
      proposals.push({
        kind: 'knowledge-proposal',
        action: 'review-github-release-change',
        previous: stableRelease(acceptedSnapshot),
        current: stableRelease(current),
      })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-release-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error instanceof GitHubPublicRepositoryReleaseError && error.code === 'rate-limited') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{ kind: 'verification-report', action: 'rerun-after-rate-limit-reset', reason: 'github-core-rate-limit', ...(error.retryAt ? { notBefore: error.retryAt } : {}) }],
      }
    }
    if (error instanceof GitHubPublicRepositoryReleaseError && error.code === 'release-not-found') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'review-required',
        proposals: [{ kind: 'knowledge-proposal', action: 'review-github-release-removed-or-retagged' }],
      }
    }
    return {
      observedAt: observedAt.toISOString(),
      status: 'unreachable',
      proposals: [{ kind: 'connector-change-proposal', action: 'restore-github-release-access', detail: error.message }],
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGitHubPublicRepositoryReleaseMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

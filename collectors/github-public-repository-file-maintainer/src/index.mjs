import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicRepositoryFile } from '../../../connectors/github-public-repository-file/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = {
  repository: 'octocat/Hello-World',
  path: 'README',
  revision: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
}

function stableFile(result) {
  if (!result?.file) return null
  return {
    repository: result.request?.repository,
    path: result.request?.path,
    revision: result.request?.revision,
    gitBlobId: result.file.gitBlobId,
    sizeBytes: result.file.sizeBytes,
    contentSha256: result.file.contentSha256,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-file/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-file/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectGitHubRepositoryFileMaintenance({ now = () => new Date(), reader = readPublicRepositoryFile, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-github-file-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-github-file-baseline' })
    else if (JSON.stringify(stableFile(current)) !== JSON.stringify(stableFile(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-immutable-file-integrity-change', previous: stableFile(acceptedSnapshot), current: stableFile(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-file-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error?.code === 'rate-limited') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{
          kind: 'verification-report',
          action: 'rerun-after-rate-limit-reset',
          reason: 'github-core-rate-limit',
          ...(error.rateLimitResetAt ? { notBefore: error.rateLimitResetAt } : {}),
        }],
      }
    }
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-github-file-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGitHubRepositoryFileMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

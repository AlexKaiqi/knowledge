import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicProjectRelease } from '../../../connectors/pypi-public-project-release/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { projectName: 'sampleproject', version: '4.0.0' }

function stableRelease(result) {
  if (!result?.release || !Array.isArray(result.distributions)) return null
  return {
    resultDigest: result.resultDigest,
    release: {
      canonicalProjectName: result.release.canonicalProjectName,
      version: result.release.version,
      requiresPython: result.release.requiresPython,
      licenseExpression: result.release.licenseExpression,
      licenseClassifiers: result.release.licenseClassifiers,
      yanked: result.release.yanked,
      yankedReason: result.release.yankedReason,
      knownVulnerabilityCount: result.release.knownVulnerabilityCount,
    },
    distributions: result.distributions.map((file) => ({
      filename: file.filename,
      sizeBytes: file.sizeBytes,
      yanked: file.yanked,
      yankedReason: file.yankedReason,
      sha256: file.sha256,
      blake2b256: file.blake2b256,
      coreMetadataSha256: file.coreMetadataSha256,
    })),
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/pypi/public-project-release/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/pypi/public-project-release/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectPyPIPublicProjectReleaseMaintenance({ now = () => new Date(), reader = readPublicProjectRelease, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-pypi-release-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-pypi-release-baseline' })
    else if (JSON.stringify(stableRelease(current)) !== JSON.stringify(stableRelease(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-pypi-release-metadata-change', previous: stableRelease(acceptedSnapshot), current: stableRelease(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/pypi-public-project-release-live.json' })
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
          reason: 'pypi-api-rate-limit',
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-pypi-json-api-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectPyPIPublicProjectReleaseMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

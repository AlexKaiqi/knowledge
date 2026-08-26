import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CratesIoPublicCrateVersionError, readPublicCrateVersion } from '../../../connectors/crates-io-public-crate-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { crateName: 'serde', version: '1.0.228' }

function stableMetadata(result) {
  if (!result?.crateVersion) return null
  return {
    crateName: result.crateVersion.crateName,
    version: result.crateVersion.version,
    licenseExpression: result.crateVersion.licenseExpression,
    rustVersion: result.crateVersion.rustVersion,
    edition: result.crateVersion.edition,
    yanked: result.crateVersion.yanked,
    yankedMessage: result.crateVersion.yankedMessage,
    createdAt: result.crateVersion.createdAt,
    updatedAt: result.crateVersion.updatedAt,
    hasLibrary: result.crateVersion.hasLibrary,
    binaryNames: result.crateVersion.binaryNames,
    links: result.crateVersion.links,
    artifact: result.crateVersion.artifact,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/crates-io/public-crate-version/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/crates-io/public-crate-version/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectCratesIoPublicCrateVersionMaintenance({ now = () => new Date(), reader = readPublicCrateVersion, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({
        kind: 'connector-change-proposal',
        action: 'review-crates-io-version-contract',
        failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-crates-io-version-baseline' })
    else if (JSON.stringify(stableMetadata(current)) !== JSON.stringify(stableMetadata(acceptedSnapshot))) {
      proposals.push({
        kind: 'knowledge-proposal',
        action: 'review-crates-io-version-metadata-change',
        previous: stableMetadata(acceptedSnapshot),
        current: stableMetadata(current),
      })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/crates-io-public-crate-version-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error instanceof CratesIoPublicCrateVersionError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{
          kind: 'verification-report',
          action: error.code === 'rate-limited' ? 'rerun-after-rate-limit-reset' : 'review-crates-io-user-agent-policy',
          reason: error.code,
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    return {
      observedAt: observedAt.toISOString(),
      status: 'unreachable',
      proposals: [{ kind: 'connector-change-proposal', action: 'restore-crates-io-api-access', detail: error.message }],
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectCratesIoPublicCrateVersionMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

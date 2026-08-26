import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicPackageVersion } from '../../../connectors/npm-public-package-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { packageName: 'ajv', version: '8.20.0' }

function stableMetadata(result) {
  if (!result?.packageVersion) return null
  return {
    name: result.packageVersion.name,
    version: result.packageVersion.version,
    license: result.packageVersion.license,
    deprecated: result.packageVersion.deprecated,
    repository: result.packageVersion.repository,
    distribution: result.packageVersion.distribution,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/npm/public-package-version/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/npm/public-package-version/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectNpmPublicPackageVersionMaintenance({ now = () => new Date(), reader = readPublicPackageVersion, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-npm-package-version-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-npm-package-version-baseline' })
    else if (JSON.stringify(stableMetadata(current)) !== JSON.stringify(stableMetadata(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-npm-package-version-metadata-change', previous: stableMetadata(acceptedSnapshot), current: stableMetadata(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/npm-public-package-version-live.json' })
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
          reason: 'npm-public-registry-rate-limit',
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-npm-public-registry-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectNpmPublicPackageVersionMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

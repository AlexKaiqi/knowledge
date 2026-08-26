import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readAuthenticatedPublicModuleVersion } from '../../../connectors/go-public-module-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { modulePath: 'rsc.io/quote', version: 'v1.5.2', publicModuleAcknowledged: true }

function stableEvidence(result) {
  if (!result?.moduleVersion?.goMod || !result?.authentication || !result?.transfer) return null
  return {
    moduleVersion: {
      modulePath: result.moduleVersion.modulePath,
      version: result.moduleVersion.version,
      publishedAt: result.moduleVersion.publishedAt,
      moduleTreeH1: result.moduleVersion.moduleTreeH1,
      goMod: {
        moduleDirective: result.moduleVersion.goMod.moduleDirective,
        content: result.moduleVersion.goMod.content,
        sizeBytes: result.moduleVersion.goMod.sizeBytes,
        sha256: result.moduleVersion.goMod.sha256,
        h1: result.moduleVersion.goMod.h1,
      },
    },
    authentication: {
      status: result.authentication.status,
      method: result.authentication.method,
      verifier: result.authentication.verifier,
      checksumDatabase: result.authentication.checksumDatabase,
    },
    transfer: {
      archiveSizeBytes: result.transfer.archiveSizeBytes,
      archiveExecuted: result.transfer.archiveExecuted,
      cacheRemoved: result.transfer.cacheRemoved,
    },
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/go/public-module-version/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/go/public-module-version/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectGoPublicModuleVersionMaintenance({ now = () => new Date(), reader = readAuthenticatedPublicModuleVersion, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-go-module-authentication-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-go-module-version-baseline' })
    else if (JSON.stringify(stableEvidence(current)) !== JSON.stringify(stableEvidence(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-go-module-version-evidence-change', previous: stableEvidence(acceptedSnapshot), current: stableEvidence(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/go-public-module-version-live.json' })
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
          reason: 'go-public-service-rate-limit',
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    const action = error?.code === 'authentication-failed'
      ? 'investigate-go-checksum-authentication-failure'
      : 'restore-go-public-module-service-access'
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action, detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGoPublicModuleVersionMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

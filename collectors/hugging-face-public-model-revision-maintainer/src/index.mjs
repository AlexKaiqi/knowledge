import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { HuggingFacePublicModelRevisionError, readPublicModelRevisionManifest } from '../../../connectors/hugging-face-public-model-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const FIXTURE_INPUT = Object.freeze({ repoId: 'openai-community/gpt2', commitSha: '607a30d783dfa663caf39e06633721c8d4cfcd7e' })

function stableManifest(result) {
  const revision = result?.modelRevision
  if (!revision) return null
  return {
    repoId: revision.repoId,
    commitSha: revision.commitSha,
    visibility: revision.visibility,
    gated: revision.gated,
    disabled: revision.disabled,
    pipelineTag: revision.pipelineTag,
    libraryName: revision.libraryName,
    tags: revision.tags,
    manifestComplete: revision.manifestComplete,
    fileCount: revision.fileCount,
    totalSizeBytes: revision.totalSizeBytes,
    fileManifestDigest: revision.fileManifestDigest,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/hugging-face/public-model-revision/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/hugging-face/public-model-revision/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectHuggingFacePublicModelRevisionMaintenance({
  now = () => new Date(),
  reader = readPublicModelRevisionManifest,
  acceptedState,
} = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(FIXTURE_INPUT)
    if (current.conformance.status !== 'passed') {
      proposals.push({
        kind: 'connector-change-proposal',
        action: 'review-hugging-face-model-revision-contract',
        failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-hugging-face-model-revision-baseline' })
    else if (JSON.stringify(stableManifest(current)) !== JSON.stringify(stableManifest(acceptedSnapshot))) {
      proposals.push({
        kind: 'knowledge-proposal',
        action: 'review-hugging-face-model-revision-change',
        previous: stableManifest(acceptedSnapshot),
        current: stableManifest(current),
      })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/hugging-face-public-model-revision-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error instanceof HuggingFacePublicModelRevisionError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{
          kind: 'verification-report',
          action: error.code === 'rate-limited' ? 'rerun-after-rate-limit-reset' : 'review-hugging-face-access-policy',
          reason: error.code,
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    if (error instanceof HuggingFacePublicModelRevisionError && error.code === 'not-found') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'review-required',
        proposals: [{ kind: 'knowledge-proposal', action: 'replace-or-review-hugging-face-model-fixture', reason: error.code }],
      }
    }
    return {
      observedAt: observedAt.toISOString(),
      status: 'unreachable',
      proposals: [{ kind: 'connector-change-proposal', action: 'restore-hugging-face-model-revision-access', detail: error.message }],
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectHuggingFacePublicModelRevisionMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

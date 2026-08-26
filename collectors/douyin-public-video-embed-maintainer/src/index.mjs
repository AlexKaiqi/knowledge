import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DouyinPublicVideoEmbedError, readPublicVideoEmbed } from '../../../connectors/douyin-public-video-embed/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const FIXTURE_INPUT = Object.freeze({ videoId: '7601036371859459343' })

function stableDescriptor(result) {
  if (!result?.videoEmbed) return null
  return {
    videoId: result.videoEmbed.videoId,
    title: result.videoEmbed.title,
    width: result.videoEmbed.width,
    height: result.videoEmbed.height,
    playerUrl: result.videoEmbed.playerUrl,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/douyin/public-video-embed/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/douyin/public-video-embed/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectDouyinPublicVideoEmbedMaintenance({
  now = () => new Date(),
  reader = readPublicVideoEmbed,
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
        action: 'review-douyin-public-video-embed-contract',
        failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-douyin-public-video-embed-baseline' })
    else if (JSON.stringify(stableDescriptor(current)) !== JSON.stringify(stableDescriptor(acceptedSnapshot))) {
      proposals.push({
        kind: 'knowledge-proposal',
        action: 'review-douyin-public-video-embed-change',
        previous: stableDescriptor(acceptedSnapshot),
        current: stableDescriptor(current),
      })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/douyin-public-video-embed-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error instanceof DouyinPublicVideoEmbedError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{ kind: 'verification-report', action: 'rerun-douyin-public-video-embed-probe', reason: error.code }],
      }
    }
    if (error instanceof DouyinPublicVideoEmbedError && error.code === 'platform-rejected') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'review-required',
        proposals: [{ kind: 'knowledge-proposal', action: 'replace-or-review-douyin-public-video-fixture', reason: error.code }],
      }
    }
    return {
      observedAt: observedAt.toISOString(),
      status: 'unreachable',
      proposals: [{ kind: 'connector-change-proposal', action: 'restore-douyin-public-video-embed-access', detail: error.message }],
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectDouyinPublicVideoEmbedMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

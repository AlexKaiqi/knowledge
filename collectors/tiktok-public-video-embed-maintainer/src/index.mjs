import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { TikTokPublicVideoEmbedError, readPublicVideoEmbed } from '../../../connectors/tiktok-public-video-embed/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const FIXTURE_INPUT = Object.freeze({ videoUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' })
function stableDescriptor(result) { return result?.videoEmbed ? { ...result.videoEmbed } : null }
async function readAcceptedState() {
  try {
    return {
      snapshot: JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/tiktok/public-video-embed/snapshot.json'), 'utf8')),
      report: JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/tiktok/public-video-embed/report.json'), 'utf8')),
    }
  } catch { return { snapshot: null, report: null } }
}

export async function collectTikTokPublicVideoEmbedMaintenance({ now = () => new Date(), reader = readPublicVideoEmbed, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(FIXTURE_INPUT)
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'review-tiktok-public-video-embed-contract', failures: current.conformance.assertions.filter((item) => !item.passed).map((item) => item.id) })
    if (!snapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-tiktok-public-video-embed-baseline' })
    else if (JSON.stringify(stableDescriptor(current)) !== JSON.stringify(stableDescriptor(snapshot))) proposals.push({ kind: 'knowledge-proposal', action: 'review-tiktok-public-video-embed-change', previous: stableDescriptor(snapshot), current: stableDescriptor(current) })
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/tiktok-public-video-embed-live.json' })
    return { observedAt: observedAt.toISOString(), status: proposals.length ? 'review-required' : 'current', proposals, current }
  } catch (error) {
    if (error instanceof TikTokPublicVideoEmbedError && ['rate-limited', 'access-policy-blocked'].includes(error.code)) return { observedAt: observedAt.toISOString(), status: 'deferred', proposals: [{ kind: 'verification-report', action: 'rerun-tiktok-public-video-embed-probe', reason: error.code }] }
    if (error instanceof TikTokPublicVideoEmbedError && error.code === 'platform-rejected') return { observedAt: observedAt.toISOString(), status: 'review-required', proposals: [{ kind: 'knowledge-proposal', action: 'replace-or-review-tiktok-public-video-fixture', reason: error.code }] }
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-tiktok-public-video-embed-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectTikTokPublicVideoEmbedMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readDouyinOpenPlatformSurface } from '../../../connectors/douyin-open-platform-docs/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export async function collectDouyinOpenPlatformMaintenance({ now = () => new Date(), reader = readDouyinOpenPlatformSurface } = {}) {
  const observedAt = now()
  const proposals = []
  let acceptedSnapshot = null
  let report = null
  try {
    acceptedSnapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/douyin/open-platform/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/douyin/open-platform/report.json'), 'utf8'))
  } catch {}
  try {
    const current = await reader()
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'knowledge-proposal', action: 'review-official-douyin-semantic-change', failures: current.conformance.assertions.filter((item) => !item.passed).map((item) => item.id) })
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-douyin-open-platform-baseline' })
    else if (current.semanticDigest !== acceptedSnapshot.semanticDigest) proposals.push({ kind: 'knowledge-proposal', action: 'review-official-douyin-change', previousDigest: acceptedSnapshot.semanticDigest, currentDigest: current.semanticDigest })
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/douyin-open-platform-docs-live.json' })
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-official-document-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectDouyinOpenPlatformMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

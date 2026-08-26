import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readAccountApiSurface } from '../../../connectors/xiaohongshu-account-docs/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export async function collectAccountDocsMaintenance({ now = () => new Date(), reader = readAccountApiSurface } = {}) {
  const observedAt = now()
  const proposals = []
  let acceptedSnapshot = null
  let report = null
  try {
    acceptedSnapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/xiaohongshu/account-api/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/xiaohongshu/account-api/report.json'), 'utf8'))
  } catch {}

  try {
    const current = await reader()
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-official-account-api-semantic-change', failures: current.conformance.assertions.filter((item) => !item.passed).map((item) => item.id) })
    }
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-account-api-baseline' })
    else if (current.semanticDigest !== acceptedSnapshot.semanticDigest) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-official-account-api-change', previousDigest: acceptedSnapshot.semanticDigest, currentDigest: current.semanticDigest })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/xiaohongshu-account-api-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    return {
      observedAt: observedAt.toISOString(),
      status: 'unreachable',
      proposals: [{ kind: 'connector-change-proposal', action: 'restore-official-document-access', detail: error.message }],
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectAccountDocsMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

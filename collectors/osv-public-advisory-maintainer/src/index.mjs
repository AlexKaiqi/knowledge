import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { OsvPublicAdvisoryError, readPublicAdvisory } from '../../../connectors/osv-public-advisory/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixture = { advisoryId: 'OSV-2020-111' }
async function accepted() {
  try { return { snapshot: JSON.parse(await readFile(path.join(root, 'knowledge/verifications/osv/public-advisory/snapshot.json'))), report: JSON.parse(await readFile(path.join(root, 'knowledge/verifications/osv/public-advisory/report.json'))) } } catch { return { snapshot: null, report: null } }
}
export async function collectOsvPublicAdvisoryMaintenance({ now = () => new Date(), reader = readPublicAdvisory, acceptedState } = {}) {
  const at = now(); const state = acceptedState ?? await accepted(); const proposals = []
  try {
    const current = await reader(fixture)
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'review-osv-advisory-contract' })
    if (!state.snapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-osv-advisory-baseline' })
    else if (current.resultDigest !== state.snapshot.resultDigest) proposals.push({ kind: 'knowledge-proposal', action: 'review-osv-advisory-change', previousModifiedAt: state.snapshot.advisory.modifiedAt, currentModifiedAt: current.advisory.modifiedAt })
    if (!state.report || Date.parse(state.report.expiresAt) <= at.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/osv-public-advisory-live.json' })
    return { observedAt: at.toISOString(), status: proposals.length ? 'review-required' : 'current', proposals, current }
  } catch (error) {
    if (error instanceof OsvPublicAdvisoryError && error.code === 'rate-limited') return { observedAt: at.toISOString(), status: 'deferred', proposals: [{ kind: 'verification-report', action: 'rerun-after-rate-limit', ...(error.retryAt ? { notBefore: error.retryAt } : {}) }] }
    if (error instanceof OsvPublicAdvisoryError && error.code === 'advisory-not-found') return { observedAt: at.toISOString(), status: 'review-required', proposals: [{ kind: 'knowledge-proposal', action: 'review-osv-advisory-removed' }] }
    return { observedAt: at.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-osv-api-access', detail: error.message }] }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const result = await collectOsvPublicAdvisoryMaintenance(); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (result.status === 'unreachable') process.exitCode = 1 }

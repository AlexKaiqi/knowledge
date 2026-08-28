import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/current-work-projection-reconciler-maintainer/sources.json'), 'utf8'))
export const currentWorkReconciliationSources = catalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkCurrentWorkReconciliationSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-current-work-reconciler-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    const digestCurrent = observedDigest === source.acceptedDocumentDigest
    return { id: source.id, status: assertions.every((item) => item.passed) && digestCurrent ? 'current' : 'review-required', observedDigest, digestCurrent, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/assistant/current-work-projection-reconciliation/report.json'), 'utf8')) } catch { return null }
}

export async function collectCurrentWorkProjectionReconciliation({ now = () => new Date(), sourceCheck = checkCurrentWorkReconciliationSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of currentWorkReconciliationSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      const implementation = source.id === 'personal-knowledge-reconciler-main'
      proposals.push({ kind: implementation ? 'connector-change-proposal' : 'knowledge-proposal', action: implementation ? 'review-production-reconciliation-change' : 'review-reconciliation-evidence-change', sourceId: source.id, observedDigest: source.observedDigest })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'knowledge-proposal', action: 'recheck-reconciliation-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/current-work-projection-reconciliation-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectCurrentWorkProjectionReconciliation(), null, 2)}\n`)

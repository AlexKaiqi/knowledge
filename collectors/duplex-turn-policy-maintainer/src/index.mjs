import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/duplex-turn-policy-maintainer/sources.json'), 'utf8'))
export const turnPolicySources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkTurnPolicySource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-catalog-maintainer' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    const digestCurrent = source.acceptedDocumentDigest === undefined || observedDigest === source.acceptedDocumentDigest
    return {
      id: source.id,
      status: digestCurrent && assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required',
      observedDigest,
      digestCurrent,
      assertions
    }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/voice/duplex-turn-policy/report.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function collectDuplexTurnPolicyMaintenance({ now = () => new Date(), sourceCheck = checkTurnPolicySource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of turnPolicySources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({
        kind: source.id === 'production-main-client' ? 'connector-change-proposal' : 'knowledge-proposal',
        action: source.id === 'production-main-client' ? 'review-upstream-turn-semantics' : 'review-turn-policy-evidence',
        sourceId: source.id,
        observedDigest: source.observedDigest
      })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'knowledge-proposal', action: 'recheck-turn-policy-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/duplex-turn-policy-local.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectDuplexTurnPolicyMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

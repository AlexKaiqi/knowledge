import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/multi-turn-response-repetition-maintainer/sources.json'), 'utf8'))
export const multiTurnResponseRepetitionSources = catalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkMultiTurnResponseRepetitionSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-response-repetition-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const content = body.toString('utf8')
    const observedDigest = digest(body)
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: content.includes(assertion.includes) }))
    const digestCurrent = observedDigest === source.acceptedDocumentDigest
    return { id: source.id, status: digestCurrent && assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest, digestCurrent, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/assistant/multi-turn-response-repetition/report.json'), 'utf8')) } catch { return null }
}

export async function collectMultiTurnResponseRepetitionMaintenance({ now = () => new Date(), sourceCheck = checkMultiTurnResponseRepetitionSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of multiTurnResponseRepetitionSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'review-response-repetition-source-change', sourceId: source.id, observedDigest: source.observedDigest })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-response-repetition-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/multi-turn-response-repetition-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectMultiTurnResponseRepetitionMaintenance(), null, 2)}\n`)

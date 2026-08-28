import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-theme-synthesis-maintainer/sources.json'), 'utf8'))
export const feedbackThemeSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkFeedbackThemeSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-theme-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
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

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/feedback/theme-synthesis/report.json'), 'utf8')) } catch { return null }
}

export async function collectFeedbackThemeSynthesisMaintenance({ now = () => new Date(), sourceCheck = checkFeedbackThemeSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of feedbackThemeSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      const connectorChange = source.id.endsWith('-main')
      proposals.push({ kind: connectorChange ? 'connector-change-proposal' : 'knowledge-proposal', action: connectorChange ? 'review-upstream-learning-contract-change' : 'review-learning-evidence-change', sourceId: source.id, observedDigest: source.observedDigest })
    } else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-feedback-theme-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-theme-synthesis-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectFeedbackThemeSynthesisMaintenance(), null, 2)}\n`)

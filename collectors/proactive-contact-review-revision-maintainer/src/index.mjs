import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/proactive-contact-review-revision-maintainer/sources.json'), 'utf8'))
export const proactiveContactSources = catalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkProactiveContactSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-proactive-contact-maintainer/1.0' }, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8').replace(/\s+/g, ' ')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    const digestCurrent = source.acceptedDocumentDigest === undefined ? null : observedDigest === source.acceptedDocumentDigest
    return { id: source.id, status: assertions.every((item) => item.passed) && digestCurrent !== false ? 'current' : 'review-required', observedDigest, digestCurrent, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/assistant/proactive-contact-review-revision/report.json'), 'utf8')) } catch { return null }
}

export async function collectProactiveContactReviewMaintenance({ now = () => new Date(), sourceCheck = checkProactiveContactSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of proactiveContactSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      const moving = source.id.endsWith('-main')
      proposals.push({ kind: moving ? 'connector-change-proposal' : 'knowledge-proposal', action: moving ? 'review-upstream-proactive-policy-change' : 'review-proactive-contact-evidence-change', sourceId: source.id, observedDigest: source.observedDigest })
    }
    if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-proactive-contact-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/proactive-contact-review-revision-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectProactiveContactReviewMaintenance(), null, 2)}\n`)

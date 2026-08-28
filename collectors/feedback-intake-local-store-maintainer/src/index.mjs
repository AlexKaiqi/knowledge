import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-store-maintainer/sources.json'), 'utf8'))
export const feedbackIntakeLocalStoreSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkFeedbackIntakeLocalStoreSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-local-store-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest: digest(body), digestCurrent: null, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-storage/report.json'), 'utf8')) } catch { return null }
}

export async function collectFeedbackIntakeLocalStoreMaintenance({ now = () => new Date(), sourceCheck = checkFeedbackIntakeLocalStoreSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of feedbackIntakeLocalStoreSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: source.id === 'node-filesystem-api' ? 'connector-change-proposal' : 'knowledge-proposal', action: source.id === 'node-filesystem-api' ? 'review-local-storage-primitive-change' : 'review-feedback-storage-boundary-change', sourceId: source.id, observedDigest: source.observedDigest })
    if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-feedback-storage-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-isolated-local-write-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-storage-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectFeedbackIntakeLocalStoreMaintenance(), null, 2)}\n`)

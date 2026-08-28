import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-withdrawal-maintainer/sources.json'), 'utf8'))
export const feedbackIntakeLocalWithdrawalSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkFeedbackIntakeLocalWithdrawalSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-local-withdrawal-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
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
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-withdrawal/report.json'), 'utf8')) } catch { return null }
}

export async function collectFeedbackIntakeLocalWithdrawalMaintenance({ now = () => new Date(), sourceCheck = checkFeedbackIntakeLocalWithdrawalSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of feedbackIntakeLocalWithdrawalSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({
      kind: source.id === 'node-filesystem-api' ? 'connector-change-proposal' : 'knowledge-proposal',
      action: source.id === 'node-filesystem-api' ? 'review-withdrawal-filesystem-semantics' : source.id === 'nist-media-sanitization' ? 'review-logical-delete-sanitization-boundary' : 'review-withdrawal-erasure-boundary',
      sourceId: source.id,
      observedDigest: source.observedDigest,
    })
    if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-feedback-withdrawal-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-isolated-withdrawal-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-withdrawal-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectFeedbackIntakeLocalWithdrawalMaintenance(), null, 2)}\n`)

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-retention-expiry-maintainer/sources.json'), 'utf8'))
export const feedbackIntakeLocalRetentionExpirySources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')
const CANDIDATE_KEYS = new Set(['storeRef', 'storageReceiptRef', 'recordDigest', 'retentionPolicyRef', 'deleteAfter', 'due'])

export async function checkFeedbackIntakeLocalRetentionExpirySource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-retention-expiry-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest: digest(body), digestCurrent: null, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('retention candidate must be an object')
  const unknown = Object.keys(candidate).filter((key) => !CANDIDATE_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`retention candidate contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof candidate.storeRef !== 'string' || typeof candidate.storageReceiptRef !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(candidate.recordDigest ?? '') || typeof candidate.retentionPolicyRef !== 'string' || !Number.isFinite(Date.parse(candidate.deleteAfter)) || typeof candidate.due !== 'boolean') throw new Error('retention candidate is malformed')
  return { storeRef: candidate.storeRef, storageReceiptRef: candidate.storageReceiptRef, recordDigest: candidate.recordDigest, retentionPolicyRef: candidate.retentionPolicyRef, deleteAfter: new Date(candidate.deleteAfter).toISOString(), due: candidate.due }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-retention-expiry/report.json'), 'utf8')) } catch { return null }
}

export async function collectFeedbackIntakeLocalRetentionExpiryMaintenance({ now = () => new Date(), sourceCheck = checkFeedbackIntakeLocalRetentionExpirySource, report, retentionCandidates = [] } = {}) {
  const observedAt = now()
  if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) throw new Error('now must return a valid Date')
  const sources = []
  for (const source of feedbackIntakeLocalRetentionExpirySources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({
      kind: source.id === 'node-filesystem-api' ? 'connector-change-proposal' : 'knowledge-proposal',
      action: source.id === 'node-filesystem-api' ? 'review-retention-deletion-filesystem-semantics' : source.id === 'nist-media-sanitization' ? 'review-retention-deletion-sanitization-boundary' : 'review-retention-policy-boundary',
      sourceId: source.id,
      observedDigest: source.observedDigest,
    })
    if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-feedback-retention-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  if (!Array.isArray(retentionCandidates) || retentionCandidates.length > 1000) throw new Error('retentionCandidates must be a bounded array')
  const candidates = retentionCandidates.map(normalizeCandidate)
  for (const candidate of candidates) {
    const actuallyDue = Date.parse(candidate.deleteAfter) <= observedAt.getTime()
    if (candidate.due !== actuallyDue) {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-retention-candidate-clock-drift', storageReceiptRef: candidate.storageReceiptRef, declaredDue: candidate.due, observedDue: actuallyDue })
      continue
    }
    if (actuallyDue) proposals.push({
      kind: 'knowledge-proposal',
      action: 'review-due-retention-deletion',
      capabilityRef: '/capabilities/feedback/expire-consented-intake-record.md',
      target: { storeRef: candidate.storeRef, storageReceiptRef: candidate.storageReceiptRef, recordDigest: candidate.recordDigest, retentionPolicyRef: candidate.retentionPolicyRef, deleteAfter: candidate.deleteAfter },
      requires: ['trusted-retention-grant', 'hold-status-clear', 'explicit-execution'],
    })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-isolated-retention-expiry-probe', probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-retention-expiry-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, candidateSummary: { observed: candidates.length, due: candidates.filter((item) => item.due).length }, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectFeedbackIntakeLocalRetentionExpiryMaintenance(), null, 2)}\n`)

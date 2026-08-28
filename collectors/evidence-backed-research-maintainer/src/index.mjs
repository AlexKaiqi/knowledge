import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/evidence-backed-research-maintainer/sources.json'), 'utf8'))
export const researchSources = sourceCatalog.sources

const digest = (value) => createHash('sha256').update(value).digest('hex')
const normalizeHtmlText = (value) => value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&nbsp;', ' ')
  .replace(/\s+/g, ' ')
  .trim()

export async function checkMethodSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const rawText = body.toString('utf8')
    const text = source.observation.mode === 'static-html-semantic' ? normalizeHtmlText(rawText) : rawText
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    const digestCurrent = source.acceptedDocumentDigest ? observedDigest === source.acceptedDocumentDigest : null
    return {
      id: source.id,
      status: digestCurrent !== false && assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required',
      observedDigest,
      digestCurrent,
      assertions,
    }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/evidence-backed-research/report.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function collectEvidenceBackedResearchMaintenance({
  now = () => new Date(),
  sourceCheck = checkMethodSource,
  report,
} = {}) {
  const observedAt = now()
  const sources = []
  for (const source of researchSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-research-method-source', sourceId: source.id, observedDigest: source.observedDigest })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'knowledge-proposal', action: 'recheck-research-method-provenance', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/evidence-backed-research-local.json' })
  }
  return {
    observedAt: observedAt.toISOString(),
    status: proposals.length === 0 ? 'current' : 'review-required',
    sources,
    proposals,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectEvidenceBackedResearchMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

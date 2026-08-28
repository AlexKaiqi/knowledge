import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/public-state-pet-behavior-maintainer/sources.json'), 'utf8'))
export const behaviorSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkBehaviorSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    return {
      id: source.id,
      status: observedDigest === source.acceptedDocumentDigest && assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required',
      observedDigest,
      digestCurrent: observedDigest === source.acceptedDocumentDigest,
      assertions,
    }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/pet/public-state-behavior/report.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function collectPublicStatePetBehaviorMaintenance({ now = () => new Date(), sourceCheck = checkBehaviorSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of behaviorSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({
        kind: source.id === 'production-main-client' ? 'connector-change-proposal' : 'knowledge-proposal',
        action: source.id === 'production-main-client' ? 'review-upstream-behavior-change' : 'review-production-provenance',
        sourceId: source.id,
        observedDigest: source.observedDigest,
      })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'knowledge-proposal', action: 'recheck-production-provenance', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/public-state-pet-behavior-local.json' })
  }
  return {
    observedAt: observedAt.toISOString(),
    status: proposals.length === 0 ? 'current' : 'review-required',
    sources,
    proposals,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectPublicStatePetBehaviorMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

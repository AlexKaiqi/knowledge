import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/bounded-work-context-maintainer/sources.json'), 'utf8'))
export const boundedWorkContextSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkBoundedWorkContextSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, {
      method: 'GET',
      redirect: 'error',
      headers: { 'user-agent': 'knowledge-bounded-work-context-maintainer/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    const observedDigest = digest(body)
    const digestCurrent = observedDigest === source.acceptedDocumentDigest
    return {
      id: source.id,
      status: assertions.every((assertion) => assertion.passed) && digestCurrent ? 'current' : 'review-required',
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
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/assistant/bounded-work-context/report.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function collectBoundedWorkContextMaintenance({ now = () => new Date(), sourceCheck = checkBoundedWorkContextSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of boundedWorkContextSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      const connectorChange = source.id.endsWith('-main')
      proposals.push({
        kind: connectorChange ? 'connector-change-proposal' : 'knowledge-proposal',
        action: connectorChange ? 'review-production-projection-change' : 'review-accepted-projection-evidence-change',
        sourceId: source.id,
        observedDigest: source.observedDigest,
      })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'knowledge-proposal', action: 'recheck-projection-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/bounded-work-context-local.json' })
  }
  return {
    observedAt: observedAt.toISOString(),
    status: proposals.length === 0 ? 'current' : 'review-required',
    sources,
    proposals,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectBoundedWorkContextMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

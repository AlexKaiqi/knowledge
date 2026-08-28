import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { searchPublicEprintMetadata, ArxivMetadataSearchError } from '../../../connectors/arxiv-public-metadata-search/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/arxiv-public-metadata-search-maintainer/sources.json'), 'utf8'))
export const arxivSources = catalog.sources
export const FIXTURE_INPUT = Object.freeze({ query: 'personal assistant', field: 'all', category: 'cs.AI', sortBy: 'submittedDate', sortOrder: 'descending', start: 0, limit: 1 })

export async function checkArxivSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const text = await response.text()
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/arxiv/public-metadata-search/report.json'), 'utf8')) } catch { return null }
}

export async function collectArxivPublicMetadataSearchMaintenance({ now = () => new Date(), sourceCheck = checkArxivSource, reader = searchPublicEprintMetadata, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of arxivSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', action: source.id === 'api-terms' ? 'review-arxiv-api-policy-change' : 'review-arxiv-api-contract-change', sourceId: source.id })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-arxiv-official-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  let current = null
  try {
    const result = await reader(FIXTURE_INPUT)
    current = { status: result.conformance.status, returnedCount: result.coverage.returnedCount, totalResults: result.coverage.totalResults, newestPublishedAt: result.entries[0]?.publishedAt ?? null, contentFilesRetained: result.coverage.contentFilesRetained }
    if (result.conformance.status !== 'passed' || result.coverage.contentFilesRetained !== false || result.coverage.checkpointSemantics !== 'offset-is-not-stable-delta') proposals.push({ kind: 'connector-change-proposal', action: 'review-arxiv-live-contract' })
  } catch (error) {
    const deferred = error instanceof ArxivMetadataSearchError && ['rate-limited', 'temporarily-unavailable'].includes(error.code)
    proposals.push({ kind: deferred ? 'verification-report' : 'connector-change-proposal', action: deferred ? 'rerun-arxiv-probe-later' : 'restore-arxiv-public-metadata-access', reason: error.code ?? 'execution-failed' })
  }
  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-arxiv-live-probe', probeDefinitionRef: 'repo:/probes/definitions/arxiv-public-metadata-search-live.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, current, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectArxivPublicMetadataSearchMaintenance(), null, 2)}\n`)

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { searchPublicAppCatalog, ApplePublicAppSearchError } from '../../../connectors/apple-public-app-search/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/apple-public-app-search-maintainer/sources.json'), 'utf8'))
export const applePublicAppSearchSources = catalog.sources
export const FIXTURE_INPUT = Object.freeze({ query: 'ChatGPT', country: 'US', surface: 'iphone', limit: 5 })
export const EXPECTED_APP_ID = '6448311069'

export async function checkApplePublicAppSearchSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, {
      method: 'GET', redirect: 'error',
      headers: { 'user-agent': 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const text = await response.text()
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/apple/public-app-search/report.json'), 'utf8')) } catch { return null }
}

function sourceChangeAction(sourceId) {
  if (sourceId === 'app-review-guidelines') return 'review-apple-data-use-policy-change'
  return 'review-apple-search-api-contract-change'
}

export async function collectApplePublicAppSearchMaintenance({ now = () => new Date(), sourceCheck = checkApplePublicAppSearchSource, reader = searchPublicAppCatalog, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of applePublicAppSearchSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', action: sourceChangeAction(source.id), sourceId: source.id })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-apple-official-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }

  let current = null
  try {
    const result = await reader(FIXTURE_INPUT)
    const expectedAppPresent = result.items.some((item) => item.appId === EXPECTED_APP_ID)
    current = {
      status: result.conformance.status,
      returnedCount: result.coverage.returnedCount,
      expectedAppPresent,
      contractStatus: result.source.contractStatus,
      observedAt: result.observedAt,
    }
    const contractCurrent = result.conformance.status === 'passed' && result.coverage.metadataOnly === true && result.coverage.corpusComplete === false && result.coverage.rankingSemantics === 'apple-search-api-unspecified' && result.coverage.resultCountSemantics === 'returned-page-size-only' && result.source.contractStatus === 'official-documentation-archive'
    if (!contractCurrent) proposals.push({ kind: 'connector-change-proposal', action: 'review-apple-public-search-live-contract' })
    if (!expectedAppPresent) proposals.push({ kind: 'knowledge-proposal', action: 'review-apple-search-fixture-disappearance', expectedAppId: EXPECTED_APP_ID })
  } catch (error) {
    const deferred = error instanceof ApplePublicAppSearchError && ['rate-limited', 'temporarily-unavailable'].includes(error.code)
    proposals.push({ kind: deferred ? 'verification-report' : 'connector-change-proposal', action: deferred ? 'rerun-apple-search-probe-later' : 'restore-apple-public-search-access', reason: error.code ?? 'execution-failed' })
  }

  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-apple-public-search-live-probe', probeDefinitionRef: 'repo:/probes/definitions/apple-public-app-search-live.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, current, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectApplePublicAppSearchMaintenance(), null, 2)}\n`)

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicGameReviewPage, SteamPublicReviewError } from '../../../connectors/steam-public-game-reviews/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/steam-public-game-reviews-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceCatalog.sources
export const FIXTURE_INPUT = Object.freeze({ appId: 620, filter: 'updated', language: 'english', reviewType: 'all', purchaseType: 'all', cursor: '*', perPage: 1, includeOfftopic: false })

function normalizeHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function checkOfficialSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const text = normalizeHtml(await response.text())
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/steam/public-game-reviews/report.json'), 'utf8'))
  } catch {
    return null
  }
}

async function readProjectionReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/steam/review-observation-projection/report.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function collectSteamPublicGameReviewsMaintenance({
  now = () => new Date(),
  sourceCheck = checkOfficialSource,
  reader = readPublicGameReviewPage,
  report,
  projectionReport,
} = {}) {
  const observedAt = now()
  const sources = []
  for (const source of officialSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', action: 'review-steam-review-documentation', sourceId: source.id })
    else if (source.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', action: 'restore-steam-official-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  let current = null
  try {
    const result = await reader(FIXTURE_INPUT)
    if (result.conformance.status !== 'passed' || result.coverage.authorIdentityRetained !== false || result.coverage.corpusComplete !== false) {
      proposals.push({
        kind: 'connector-change-proposal',
        action: 'review-steam-public-review-contract',
        failures: result.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id),
      })
    }
    current = {
      status: result.conformance.status,
      returnedCount: result.coverage.returnedCount,
      authorIdentityRetained: result.coverage.authorIdentityRetained,
      corpusComplete: result.coverage.corpusComplete,
      newestUpdatedAt: result.reviews?.[0]?.updatedAt ?? null,
      summaryTotalReviews: result.summary?.totalReviews ?? null,
    }
  } catch (error) {
    if (error instanceof SteamPublicReviewError && error.code === 'http-error' && error.details.status === 429) {
      proposals.push({ kind: 'verification-report', action: 'rerun-after-rate-limit', reason: 'rate-limited' })
    } else {
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-steam-public-review-access', reason: error.code ?? 'execution-failed', detail: error.message })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-public-game-reviews-live.json' })
  }
  const acceptedProjectionReport = projectionReport === undefined ? await readProjectionReport() : projectionReport
  if (!acceptedProjectionReport || Date.parse(acceptedProjectionReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-observation-projection-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-review-observation-projection-local.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, current, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectSteamPublicGameReviewsMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/appfigures-public-app-reviews-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceCatalog.sources

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
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = normalizeHtml(await response.text())
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, role: source.role, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try {
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/public-app-review-snapshot/report.json'), 'utf8'))
  } catch {
    return null
  }
}

function driftAction(role) {
  if (role === 'official-auth-contract') return 'review-app-data-authentication-contract'
  if (role === 'official-product-contract') return 'review-store-product-resolution-contract'
  if (role === 'official-access-license-pricing') return 'review-app-data-credits-and-license'
  return 'review-public-app-review-contract'
}

export async function collectAppfiguresPublicAppReviewsMaintenance({
  now = () => new Date(),
  sourceCheck = checkOfficialSource,
  report,
} = {}) {
  const observedAt = now()
  const sources = []
  for (const source of officialSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({ kind: 'connector-change-proposal', action: driftAction(source.role), sourceId: source.id, failures: source.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-app-data-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-public-app-review-probe',
      probeDefinitionRef: 'repo:/probes/definitions/appfigures-public-app-reviews-live.json',
      requires: ['internal-research-account', 'api-client-and-pat', 'public-data-add-on', 'at-least-five-credits', 'commercial-use-determination', 'credential-ref', 'identity-pool', 'credit-cost-approval'],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-public-app-review-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-public-app-review-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/appfigures-public-app-reviews-live.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectAppfiguresPublicAppReviewsMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

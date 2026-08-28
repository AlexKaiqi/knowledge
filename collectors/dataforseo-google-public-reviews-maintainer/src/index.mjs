import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/dataforseo-google-public-reviews-maintainer/sources.json'), 'utf8'))
export const officialSources = catalog.sources

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

export async function checkOfficialSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = normalizeHtmlText(await response.text())
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, role: source.role, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/dataforseo-google-public-reviews/report.json'), 'utf8')) } catch { return null }
}

function driftAction(role) {
  if (role.includes('pricing') || role.includes('payment')) return 'review-dataforseo-google-review-price-or-account-change'
  if (role.includes('legal') || role.includes('target-platform')) return 'review-dataforseo-google-review-use-or-rights-change'
  if (role.includes('sensitive-field')) return 'review-dataforseo-google-review-field-or-redaction-change'
  if (role.includes('sandbox')) return 'review-dataforseo-google-review-sandbox-change'
  if (role.includes('failure') || role.includes('async')) return 'review-dataforseo-google-review-task-lifecycle-change'
  return 'review-dataforseo-google-review-api-contract-change'
}

export async function collectDataForSeoGooglePublicReviewMaintenance({ now = () => new Date(), sourceCheck = checkOfficialSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of officialSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({ kind: 'connector-change-proposal', action: driftAction(source.role), sourceId: source.id, failures: source.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-dataforseo-google-review-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-dataforseo-google-public-review-probes',
      sandboxProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-sandbox.json',
      liveProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-live.json',
      requires: [
        'dataforseo-account-registration-and-terms-acceptance',
        'opaque-dataforseo-api-login-and-api-password',
        'approved-probe-identity-pool',
        'supplier-and-google-content-use-rights-review',
        'data-protection-review-for-self-disclosed-review-content',
        'sandbox-shape-and-redaction-pass',
        'trial-credit-or-approved-balance-with-auto-recharge-disabled',
        'duplicate-task-protection-and-suspend-resume-executor',
        'usd-0.002-live-cost-approval',
      ],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-dataforseo-google-public-review-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-dataforseo-google-public-review-probes-after-approval', liveProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-live.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectDataForSeoGooglePublicReviewMaintenance(), null, 2)}\n`)

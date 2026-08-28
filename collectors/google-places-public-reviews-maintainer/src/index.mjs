import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/google-places-public-reviews-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceCatalog.sources

function normalizeDocument(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function checkOfficialSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, {
      method: 'GET',
      headers: { accept: 'text/html', 'user-agent': 'knowledge-google-places-review-maintainer/0.1' },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = normalizeDocument(await response.text())
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, role: source.role, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/public-place-review-snapshot/report.json'), 'utf8')) } catch { return null }
}

function driftAction(role) {
  if (role === 'official-pricing-contract' || role === 'official-field-billing-contract') return 'review-google-places-price-or-field-billing-change'
  if (role === 'official-retention-and-attribution-policy') return 'review-google-places-retention-or-attribution-change'
  if (role === 'official-review-schema') return 'review-google-place-review-schema-change'
  return 'review-google-places-api-contract-change'
}

export async function collectGooglePlacesPublicReviewMaintenance({ now = () => new Date(), sourceCheck = checkOfficialSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of officialSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') {
      proposals.push({ kind: 'connector-change-proposal', action: driftAction(source.role), sourceId: source.id, failures: source.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    } else if (source.status === 'unreachable') {
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-google-places-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-google-places-public-review-probe',
      probeDefinitionRef: 'repo:/probes/definitions/google-places-public-reviews-live.json',
      requires: [
        'google-cloud-project-and-billing',
        'places-api-new-enabled',
        'restricted-api-key-credential-ref',
        'probe-identity-and-pool',
        'maps-platform-terms-and-eea-status-review',
        'public-terms-privacy-and-google-maps-attribution-surface',
        'ephemeral-author-attribution-display',
        'no-durable-places-content-or-identity-graph',
        'usd-0.03-cost-approval',
      ],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-google-places-public-review-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-google-places-public-review-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/google-places-public-reviews-live.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectGooglePlacesPublicReviewMaintenance(), null, 2)}\n`)

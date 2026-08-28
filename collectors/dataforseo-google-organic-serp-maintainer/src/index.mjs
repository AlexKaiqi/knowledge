import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/dataforseo-google-organic-serp-maintainer/sources.json'), 'utf8'))
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
    return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/google-organic-result-page/report.json'), 'utf8'))
  } catch {
    return null
  }
}

function driftAction(role) {
  if (role === 'official-pricing') return 'review-serp-price-and-cost-bounds'
  if (role === 'official-auth-contract') return 'review-provider-authentication-contract'
  if (role === 'official-sandbox-contract') return 'review-provider-sandbox-contract'
  return 'review-google-organic-serp-contract'
}

export async function collectDataForSeoGoogleOrganicSerpMaintenance({
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
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-provider-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
    }
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-provider-probes',
      probeDefinitionRefs: [
        'repo:/probes/definitions/dataforseo-google-organic-serp-sandbox.json',
        'repo:/probes/definitions/dataforseo-google-organic-serp-live.json',
      ],
      requires: ['provider-account', 'credential-ref', 'identity-pool', 'live-cost-approval'],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-google-organic-serp-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-live-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-organic-serp-live.json' })
  }
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectDataForSeoGoogleOrganicSerpMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

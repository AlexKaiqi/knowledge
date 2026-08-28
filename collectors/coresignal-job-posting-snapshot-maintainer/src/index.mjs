import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/coresignal-job-posting-snapshot-maintainer/sources.json'), 'utf8'))
export const officialSources = sourceCatalog.sources

function normalizeDocument(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\\_/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function checkOfficialSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', headers: { accept: source.observation.mode === 'static-text-semantic' ? 'text/markdown' : 'text/html' }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = normalizeDocument(await response.text())
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, role: source.role, status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required', assertions }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/research/job-posting-snapshot/report.json'), 'utf8')) } catch { return null }
}

function driftAction(role) {
  if (role === 'official-pricing-contract' || role === 'official-billing-contract') return 'review-job-data-credit-contract'
  if (role === 'official-data-provenance' || role === 'official-legal-boundary') return 'review-job-data-license-and-provenance'
  return 'review-job-data-api-contract'
}

export async function collectCoresignalJobPostingMaintenance({ now = () => new Date(), sourceCheck = checkOfficialSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of officialSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: driftAction(source.role), sourceId: source.id, failures: source.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    else if (source.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', action: 'restore-job-data-source-observation', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-job-posting-probe',
      probeDefinitionRef: 'repo:/probes/definitions/coresignal-job-posting-snapshot-live.json',
      requires: ['provider-account', 'trial-or-paid-data-agreement', 'commercial-research-use-determination', 'api-key-credential-ref', 'provider-probe-identity-and-pool', 'ten-credit-budget-approval', 'china-coverage-review'],
    })
  } else if (acceptedReport.outcome !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'investigate-job-posting-probe-failure', reportId: acceptedReport.id })
  else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-job-posting-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/coresignal-job-posting-snapshot-live.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectCoresignalJobPostingMaintenance(), null, 2)}\n`)

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/steam-early-access-revision-maintainer/sources.json'), 'utf8'))
export const steamEarlyAccessSources = catalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')
const normalize = (value) => value.replace(/<[^>]+>/g, ' ').replaceAll('&quot;', '"').replaceAll('&amp;', '&').replace(/\s+/g, ' ')

export async function checkSteamEarlyAccessSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-early-access-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = normalize(body.toString('utf8'))
    const observedDigest = digest(body)
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/steam/early-access-review-revision/report.json'), 'utf8')) } catch { return null }
}

export async function collectSteamEarlyAccessRevisionMaintenance({ now = () => new Date(), sourceCheck = checkSteamEarlyAccessSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of steamEarlyAccessSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'review-steam-early-access-rule-change', sourceId: source.id, observedDigest: source.observedDigest })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-steam-early-access-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-early-access-review-revision-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectSteamEarlyAccessRevisionMaintenance(), null, 2)}\n`)

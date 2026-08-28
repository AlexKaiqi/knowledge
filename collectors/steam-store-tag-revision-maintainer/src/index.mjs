import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/steam-store-tag-revision-maintainer/sources.json'), 'utf8'))
export const tagRevisionSources = catalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkTagRevisionSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-tag-maintainer/1.0' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8').replace(/\s+/g, ' ')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest: digest(body), assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function readReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/steam/store-tag-review-revision/report.json'), 'utf8')) } catch { return null }
}

export async function collectSteamStoreTagRevisionMaintenance({ now = () => new Date(), sourceCheck = checkTagRevisionSource, report } = {}) {
  const observedAt = now()
  const sources = []
  for (const source of tagRevisionSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', action: 'review-official-steam-tag-semantics', sourceId: source.id, observedDigest: source.observedDigest })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-official-steam-tag-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  const acceptedReport = report === undefined ? await readReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-store-tag-review-revision-local.json' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectSteamStoreTagRevisionMaintenance(), null, 2)}\n`)

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/demand-signal-route-maintainer/sources.json'), 'utf8'))
export const demandRouteSources = sourceCatalog.sources
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkDemandRouteSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-demand-route-maintainer/1.0' }, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) return { id: source.id, status: 'unreachable', httpStatus: response.status }
    const body = Buffer.from(await response.arrayBuffer())
    const text = body.toString('utf8')
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return { id: source.id, status: assertions.every((item) => item.passed) ? 'current' : 'review-required', observedDigest: digest(body), digestCurrent: null, assertions }
  } catch (error) {
    return { id: source.id, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

export async function collectDemandSignalRouteMaintenance({ now = () => new Date(), sourceCheck = checkDemandRouteSource } = {}) {
  const sources = []
  for (const source of demandRouteSources) sources.push(await sourceCheck(source))
  const proposals = []
  for (const source of sources) {
    const definition = demandRouteSources.find((item) => item.id === source.id)
    if (source.status === 'review-required') proposals.push({ kind: 'knowledge-proposal', action: definition?.role === 'provider-pricing' ? 'review-provider-price-or-plan-change' : 'review-demand-route-semantics-change', sourceId: source.id, observedDigest: source.observedDigest })
    else if (source.status === 'unreachable') proposals.push({ kind: 'knowledge-proposal', action: 'recheck-demand-route-source', sourceId: source.id, reason: source.detail ?? `HTTP_${source.httpStatus}` })
  }
  return { observedAt: now().toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(await collectDemandSignalRouteMaintenance(), null, 2)}\n`)

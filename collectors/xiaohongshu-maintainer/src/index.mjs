import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const officialSources = [
  { id: 'share-sdk', url: 'https://agora.xiaohongshu.com/doc/ability', role: 'client-mediated-share' },
  { id: 'share-sdk-qa', url: 'https://agora.xiaohongshu.com/doc/qa', role: 'share-limitations' },
  { id: 'account-api', url: 'https://openaccount.xiaohongshu.com/docs/api-reference', role: 'oauth-and-basic-profile' },
  { id: 'commerce-api', url: 'https://open.xiaohongshu.com/home', role: 'merchant-commerce' },
  { id: 'community-convention', url: 'https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4', role: 'content-policy' },
]

async function defaultSourceCheck(source, fetchImpl) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    return { ...source, status: response.ok ? 'reachable' : 'changed', httpStatus: response.status }
  } catch (error) {
    return { ...source, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

async function defaultUpstreamHead(repository) {
  const result = await exec('git', ['ls-remote', repository, 'refs/heads/main'], { maxBuffer: 1024 * 1024 })
  return result.stdout.trim().split(/\s+/)[0] ?? ''
}

async function defaultArtifactCheck(runtimeRoot) {
  const binaries = ['xiaohongshu-mcp', 'xiaohongshu-login']
  const checks = []
  for (const binary of binaries) {
    try {
      await access(path.join(runtimeRoot, 'bin', binary))
      checks.push({ id: binary, status: 'present' })
    } catch {
      checks.push({ id: binary, status: 'missing' })
    }
  }
  return checks
}

export async function collectXiaohongshuMaintenance({
  fetchImpl = fetch,
  sourceCheck = defaultSourceCheck,
  upstreamHead = defaultUpstreamHead,
  artifactCheck = defaultArtifactCheck,
  now = () => new Date(),
  runtimeRoot = path.join(repositoryRoot, '.runtime/xiaohongshu-browser'),
} = {}) {
  const upstream = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/upstream.json'), 'utf8'))
  const connector = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/connector.json'), 'utf8'))
  const [sources, currentHead, artifacts] = await Promise.all([
    Promise.all(officialSources.map((source) => sourceCheck(source, fetchImpl))),
    upstreamHead(upstream.repository),
    artifactCheck(runtimeRoot),
  ])
  const canonicalCapabilityPath = path.join(repositoryRoot, 'knowledge/capabilities/xiaohongshu/publish-private-note-and-observe.md')
  let canonicalCapability = false
  try { await access(canonicalCapabilityPath); canonicalCapability = true } catch {}
  const observedAt = now().toISOString()
  const blockers = []
  if (connector.conformance.status !== 'verified') blockers.push('connector-not-live-verified')
  if (!canonicalCapability) blockers.push('capability-not-admitted')
  if (currentHead !== upstream.commit) blockers.push('upstream-head-changed')
  if (sources.some((source) => source.status !== 'reachable')) blockers.push('official-source-check-failed')
  if (artifacts.some((artifact) => artifact.status !== 'present')) blockers.push('local-runtime-not-built')
  return {
    schemaVersion: 'knowledge.maintenance-report/v1',
    subject: 'xiaohongshu',
    observedAt,
    mode: 'proposal-only',
    sources,
    upstream: {
      repository: upstream.repository,
      pinnedCommit: upstream.commit,
      currentHead,
      status: currentHead === upstream.commit ? 'current' : 'review-required',
    },
    connector: { id: connector.id, conformance: connector.conformance.status, artifacts },
    canonicalCapability,
    blockers: [...new Set(blockers)],
    proposals: blockers.includes('upstream-head-changed')
      ? [{ kind: 'connector-change-proposal', action: 'audit-new-upstream-before-repin' }]
      : [],
    nextRequiredGate: connector.conformance.status === 'verified' ? 'none' : 'explicit-live-probe-approval',
  }
}

async function main() {
  const report = await collectXiaohongshuMaintenance()
  const outputRoot = path.join(repositoryRoot, '.staging/xiaohongshu-maintainer')
  await mkdir(outputRoot, { recursive: true, mode: 0o700 })
  const filename = `${report.observedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`
  const output = path.join(outputRoot, filename)
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ ...report, reportPath: path.relative(repositoryRoot, output) }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

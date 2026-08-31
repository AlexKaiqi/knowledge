import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/optifeed-radar-ai-readiness/upstream.json'), 'utf8'))

async function defaultRemoteHead() {
  const { stdout } = await exec('git', ['ls-remote', upstream.repository, 'refs/heads/main'], { maxBuffer: 1024 * 1024 })
  const head = stdout.trim().split(/\s+/)[0]
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('upstream-head-observation-invalid')
  return head
}

async function defaultLocalRuntime(radarRoot) {
  try {
    const [packageJson, gitResult] = await Promise.all([
      readFile(path.join(radarRoot, 'package.json'), 'utf8').then(JSON.parse),
      exec('git', ['-C', radarRoot, 'rev-parse', 'HEAD'], { maxBuffer: 1024 * 1024 }),
      access(path.join(radarRoot, 'dist/core/run/index.js')),
      access(path.join(radarRoot, 'dist/core/fetcher/index.js')),
    ])
    return { packageName: packageJson.name, packageVersion: packageJson.version, license: packageJson.license, commit: gitResult.stdout.trim(), built: true }
  } catch {
    return null
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/distribution/ai-readiness-audit/report.json'), 'utf8')) } catch { return null }
}

export async function collectOptifeedRadarAiReadinessMaintenance({
  now = () => new Date(),
  remoteHead = defaultRemoteHead,
  localRuntime = defaultLocalRuntime,
  report,
  radarRoot = path.resolve(process.env.OPTIFEED_RADAR_ROOT ?? path.join(repositoryRoot, '.runtime/optifeed-radar')),
} = {}) {
  const observedAt = now()
  const proposals = []
  let observedHead = null
  let runtime = null
  try {
    [observedHead, runtime] = await Promise.all([remoteHead(), localRuntime(radarRoot)])
  } catch (error) {
    proposals.push({ kind: 'connector-change-proposal', action: 'restore-optifeed-radar-upstream-observation', detail: error.message })
  }
  if (observedHead && observedHead !== upstream.acceptedCommit) proposals.push({ kind: 'knowledge-proposal', action: 'review-optifeed-radar-upstream-change', acceptedCommit: upstream.acceptedCommit, observedCommit: observedHead })
  if (!runtime) proposals.push({ kind: 'connector-change-proposal', action: 'restore-reviewed-optifeed-radar-runtime' })
  else if (runtime.packageName !== upstream.packageName || runtime.packageVersion !== upstream.packageVersion || runtime.license !== upstream.license || runtime.commit !== upstream.acceptedCommit || runtime.built !== true) {
    proposals.push({ kind: 'connector-change-proposal', action: 'review-optifeed-radar-runtime-drift', observed: runtime })
  }
  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport || Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/optifeed-radar-ai-readiness-live.json' })
  return {
    observedAt: observedAt.toISOString(),
    status: proposals.length === 0 ? 'current' : 'review-required',
    upstream: { acceptedCommit: upstream.acceptedCommit, observedCommit: observedHead },
    runtime,
    proposals,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectOptifeedRadarAiReadinessMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

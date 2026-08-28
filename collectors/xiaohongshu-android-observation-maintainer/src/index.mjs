import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFile = promisify(execFileCallback)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceCatalog = JSON.parse(await readFile(path.join(root, 'collectors/xiaohongshu-android-observation-maintainer/sources.json'), 'utf8'))
const upstreamCatalog = JSON.parse(await readFile(path.join(root, 'connectors/xiaohongshu-android-observation/upstreams.json'), 'utf8'))
export const mobileObservationSources = sourceCatalog.sources
export const mobileObservationProjects = upstreamCatalog.projects

const capabilityRef = '/capabilities/research/search-public-social-content.md'
const digest = (value) => createHash('sha256').update(value).digest('hex')

export async function checkMobileObservationSource(source, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000) })
    if (!response.ok) return { id: source.id, role: source.role, status: 'unreachable', httpStatus: response.status }
    const text = (await response.text()).replace(/\r\n/g, '\n')
    if (Buffer.byteLength(text) > 2_097_152) return { id: source.id, role: source.role, status: 'review-required', reason: 'document-too-large' }
    const assertions = source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: text.includes(assertion.includes) }))
    return {
      id: source.id,
      role: source.role,
      status: assertions.every((assertion) => assertion.passed) ? 'current' : 'review-required',
      observedDigest: digest(text),
      assertions,
    }
  } catch (error) {
    return { id: source.id, role: source.role, status: 'unreachable', detail: error.name === 'TimeoutError' ? 'timeout' : 'request-failed' }
  }
}

export async function readMobileObservationHead(repository) {
  const result = await execFile('git', ['ls-remote', repository, 'refs/heads/main'], { timeout: 20_000, maxBuffer: 1_048_576 })
  const match = result.stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\/main$/)
  if (!match) throw new Error('main branch was not resolved')
  return match[1]
}

export async function inspectLocalAndroidRuntime(execFileImpl = execFile) {
  const candidates = [...new Set([
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools/adb') : null,
    process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools/adb') : null,
    path.join(homedir(), 'Library/Android/sdk/platform-tools/adb'),
    'adb',
  ].filter(Boolean))]
  for (const candidate of candidates) {
    try {
      const result = await execFileImpl(candidate, ['devices', '-l'], { timeout: 10_000, maxBuffer: 1_048_576 })
      const states = { device: 0, offline: 0, unauthorized: 0, other: 0 }
      for (const line of result.stdout.split('\n').slice(1).map((value) => value.trim()).filter(Boolean)) {
        const state = line.split(/\s+/)[1]
        if (Object.hasOwn(states, state)) states[state] += 1
        else states.other += 1
      }
      return {
        adbAvailable: true,
        connectedDeviceCount: states.device,
        blockedDeviceCount: states.offline + states.unauthorized + states.other,
        ready: states.device === 1 && states.offline + states.unauthorized + states.other === 0,
      }
    } catch (error) {
      if (error.code !== 'ENOENT') return { adbAvailable: true, connectedDeviceCount: 0, blockedDeviceCount: 0, ready: false, reason: 'adb-check-failed' }
    }
  }
  return { adbAvailable: false, connectedDeviceCount: 0, blockedDeviceCount: 0, ready: false, reason: 'adb-unavailable' }
}

async function readIdentityPermission() {
  try {
    const identity = JSON.parse(await readFile(path.join(root, 'probes/identities/xiaohongshu-owned-default.json'), 'utf8'))
    return Array.isArray(identity.allowedCapabilityRefs) && identity.allowedCapabilityRefs.includes(capabilityRef)
  } catch {
    return false
  }
}

async function readAcceptedReport() {
  try { return JSON.parse(await readFile(path.join(root, 'knowledge/verifications/research/xiaohongshu-android-public-search/report.json'), 'utf8')) } catch { return null }
}

function sourceAction(role) {
  if (role === 'device-runtime-license') return 'review-mobilerun-portal-license-change'
  if (role === 'device-protocol-contract') return 'review-mobilerun-portal-protocol-change'
  return 'review-appium-mobile-observation-contract-change'
}

export async function collectXiaohongshuAndroidObservationMaintenance({
  now = () => new Date(),
  sourceCheck = checkMobileObservationSource,
  headReader = readMobileObservationHead,
  runtimeInspector = inspectLocalAndroidRuntime,
  identityAllowed,
  report,
} = {}) {
  const observedAt = now()
  const proposals = []
  const sources = []
  for (const source of mobileObservationSources) {
    const observation = await sourceCheck(source)
    sources.push(observation)
    if (observation.status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: sourceAction(source.role), sourceId: source.id, failures: observation.assertions?.filter((item) => !item.passed).map((item) => item.id) ?? [] })
    else if (observation.status === 'unreachable') proposals.push({ kind: 'connector-change-proposal', action: 'restore-mobile-observation-source-check', sourceId: source.id, reason: observation.detail ?? `HTTP_${observation.httpStatus}` })
  }

  const projects = []
  for (const project of mobileObservationProjects) {
    try {
      const currentHead = await headReader(project.repository)
      const status = currentHead === project.commit ? 'current' : 'review-required'
      projects.push({ id: project.id, acceptedRevision: project.commit, currentHead, status })
      if (status === 'review-required') proposals.push({ kind: 'connector-change-proposal', action: 'audit-mobile-observation-project-head-change', projectId: project.id, previous: project.commit, current: currentHead })
    } catch (error) {
      projects.push({ id: project.id, acceptedRevision: project.commit, currentHead: null, status: 'unreachable' })
      proposals.push({ kind: 'connector-change-proposal', action: 'restore-mobile-observation-project-check', projectId: project.id, reason: error.message })
    }
  }

  const runtime = await runtimeInspector()
  if (!runtime.ready) {
    proposals.push({
      kind: 'connector-change-proposal',
      action: 'attach-or-create-dedicated-android-probe',
      reason: runtime.adbAvailable ? (runtime.blockedDeviceCount > 0 ? 'android-device-not-ready' : 'no-android-device') : runtime.reason,
    })
  }

  const permitted = identityAllowed === undefined ? await readIdentityPermission() : identityAllowed
  if (!permitted) proposals.push({ kind: 'connector-change-proposal', action: 'review-xiaohongshu-android-probe-identity-extension', capabilityRef })

  const acceptedReport = report === undefined ? await readAcceptedReport() : report
  if (!acceptedReport) {
    proposals.push({
      kind: 'verification-report',
      action: 'prepare-approved-xiaohongshu-android-search-probe',
      probeDefinitionRef: 'repo:/probes/definitions/xiaohongshu-android-public-search-live.json',
      requires: ['dedicated-android-device', 'manual-visible-login', 'identity-capability-approval', 'loopback-runtime', 'accessibility-permission-review', 'fixed-query-approval'],
    })
  } else if (acceptedReport.outcome !== 'passed') {
    proposals.push({ kind: 'connector-change-proposal', action: 'investigate-xiaohongshu-android-search-probe-failure', reportId: acceptedReport.id })
  } else if (Date.parse(acceptedReport.expiresAt) <= observedAt.getTime()) {
    proposals.push({ kind: 'verification-report', action: 'rerun-xiaohongshu-android-search-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/xiaohongshu-android-public-search-live.json' })
  }

  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', sources, projects, runtime, identityPermitted: permitted, proposals }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await collectXiaohongshuAndroidObservationMaintenance(), null, 2)}\n`)
}

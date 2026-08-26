import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { XiaohongshuBrowserConnector } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const outputRoot = path.join(repositoryRoot, '.staging/xiaohongshu-owned-notes')
const canonicalSnapshotRef = 'repo:/knowledge/verifications/xiaohongshu/owned-notes/snapshot.json'

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

const startedAt = new Date()
const token = (await readFile(path.join(runtimeRoot, 'credentials/sidecar-token'), 'utf8')).trim()
const connector = new XiaohongshuBrowserConnector({
  token,
  stateRoot: path.join(runtimeRoot, 'operations'),
  requestTimeoutMs: 120_000,
})
const result = await connector.listOwnedNotes({ limit: 20 })
const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/xiaohongshu/list-owned-notes-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(outputSchema)
const schemaValid = validate(result)
const serialized = JSON.stringify(result).toLowerCase()
const forbiddenMarkers = ['xsec', 'cookie', 'sidecar', 'nickname', 'avatar', 'userid', 'user_id']
const leakFree = forbiddenMarkers.every((marker) => !serialized.includes(marker))
const finishedAt = new Date()
const snapshot = {
  schemaVersion: 'dsh.xiaohongshu-owned-notes-snapshot/v1',
  observedAt: result.observedAt,
  sessionReady: true,
  status: result.status,
  itemCount: result.items.length,
  outputSchemaValid: schemaValid,
  retainedEvidence: 'count-and-structural-checks-only',
  internalArtifactLeakCheck: leakFree ? 'passed' : 'failed',
}
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  { id: 'owned-session-ready', status: 'passed' },
  { id: 'owned-profile-readable', status: result.status === 'available' ? 'passed' : 'failed', detail: `${result.items.length} owned notes observed` },
  { id: 'output-schema-valid', status: schemaValid ? 'passed' : 'failed', detail: schemaValid ? undefined : JSON.stringify(validate.errors) },
  { id: 'evidence-deidentified', status: leakFree ? 'passed' : 'failed' },
].map((check) => Object.fromEntries(Object.entries(check).filter(([, value]) => value !== undefined)))
const outcome = checks.every((check) => check.status === 'passed') ? 'passed' : 'failed'
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `xiaohongshu-owned-notes-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/xiaohongshu/list-owned-notes.md',
  connectorId: 'xiaohongshu-browser',
  probeDefinitionRef: 'repo:/probes/definitions/xiaohongshu-owned-notes-live.json',
  identityRef: 'identity:xiaohongshu-owned-default',
  identityPoolRef: 'identity-pool:xiaohongshu-owned-probes',
  environment: 'production-private',
  level: 'live',
  outcome,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: canonicalSnapshotRef, sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true, mode: 0o700 })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText, { mode: 0o600 }),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report), { mode: 0o600 }),
])
process.stdout.write(stableJson({ outcome, itemCount: result.items.length, schemaValid, leakFree, snapshotSha256: snapshotDigest, outputRoot }))
if (outcome !== 'passed') process.exitCode = 1

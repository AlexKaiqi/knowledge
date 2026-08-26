import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readDouyinOpenPlatformSurface } from '../connectors/douyin-open-platform-docs/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/douyin-open-platform-docs')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const startedAt = new Date()
const result = await readDouyinOpenPlatformSurface()
const finishedAt = new Date()
const snapshot = { schemaVersion: 'dsh.douyin-open-platform-snapshot/v1', ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `douyin-open-platform-docs-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/douyin/read-open-platform-surface.md',
  connectorId: 'douyin-open-platform-docs',
  probeDefinitionRef: 'repo:/probes/definitions/douyin-open-platform-docs-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: result.conformance.status === 'passed' ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks: result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/douyin/open-platform/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, semanticDigest: result.semanticDigest, snapshotSha256: snapshotDigest, outputRoot }))
if (report.outcome !== 'passed') process.exitCode = 1

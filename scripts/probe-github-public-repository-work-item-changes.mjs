import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURE_INPUT, FIXTURE_NUMBER } from '../collectors/github-public-repository-work-item-changes-maintainer/src/index.mjs'
import { listPublicRepositoryWorkItemChanges } from '../connectors/github-public-repository-work-item-changes/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/github-public-repository-work-item-changes')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

function outputKeys(value, result = new Set()) {
  if (Array.isArray(value)) for (const item of value) outputKeys(item, result)
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { result.add(key.toLowerCase()); outputKeys(item, result) }
  return result
}

const startedAt = new Date()
const result = await listPublicRepositoryWorkItemChanges(FIXTURE_INPUT)
const finishedAt = new Date()
const fixture = result.items.find((item) => item.number === FIXTURE_NUMBER)
const fixtureMatched = fixture?.kind === 'issue'
  && fixture.url === 'https://github.com/tamnd/xiaohongshu-cli/issues/18'
  && fixture.title === 'v0.3.0: know why you were refused before you say so'
const checkpointAdvanced = result.nextCheckpoint.updatedAt >= FIXTURE_INPUT.checkpoint.updatedAt
  && Array.isArray(result.nextCheckpoint.seenItemDigests)
const bounded = result.coverage.requestsMade <= 5 && result.items.length <= FIXTURE_INPUT.maxItems && result.coverage.complete
const forbiddenKeys = ['user', 'author', 'assignee', 'assignees', 'email', 'avatar', 'rawpayload', 'rawresponse', 'token', 'credential']
const keys = outputKeys(result)
const minimized = forbiddenKeys.every((key) => !keys.has(key))
const bodyExcluded = fixture && !JSON.stringify(result).includes('know why you were refused before you say so\n')
const passed = result.conformance.status === 'passed' && fixtureMatched && checkpointAdvanced && bounded && minimized && bodyExcluded
const snapshot = {
  schemaVersion: 'dsh.github-public-repository-work-item-changes-snapshot/v1',
  fixture: { input: FIXTURE_INPUT, expectedItem: { number: FIXTURE_NUMBER, kind: 'issue', url: 'https://github.com/tamnd/xiaohongshu-cli/issues/18', title: 'v0.3.0: know why you were refused before you say so' } },
  ...result,
}
const snapshotText = stableJson(snapshot)
const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex')
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `github-public-repository-work-item-changes-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/github/list-public-repository-work-item-changes.md',
  connectorId: 'github-public-repository-work-item-changes',
  probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-work-item-changes-live.json',
  environment: 'production-public', level: 'live', outcome: passed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks: [
    ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
    { id: 'fixture-work-item', status: fixtureMatched ? 'passed' : 'failed' },
    { id: 'checkpoint-advanced', status: checkpointAdvanced ? 'passed' : 'failed' },
    { id: 'complete-bounded-window', status: bounded ? 'passed' : 'failed' },
    { id: 'data-minimization', status: minimized && bodyExcluded ? 'passed' : 'failed' },
  ],
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/github/public-repository-work-item-changes/snapshot.json', sha256: snapshotSha256 }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, repositoryUrl: result.repositoryUrl, returnedCount: result.items.length, requestsMade: result.coverage.requestsMade, complete: result.coverage.complete, fixtureMatched, windowDigest: result.windowDigest, snapshotSha256, outputRoot }))
if (!passed) process.exitCode = 1

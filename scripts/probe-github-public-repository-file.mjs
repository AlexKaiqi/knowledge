import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicRepositoryFile } from '../connectors/github-public-repository-file/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/github-public-repository-file')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = {
  repository: 'octocat/Hello-World',
  path: 'README',
  revision: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
}
const expected = {
  gitBlobId: '980a0d5f19a64b4b30a87d4206aade58726b60e3',
  contentSha256: '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340',
}

const startedAt = new Date()
const result = await readPublicRepositoryFile(fixtureInput)
const finishedAt = new Date()
const identityMatched = result.request.repository === fixtureInput.repository
  && result.request.path === fixtureInput.path
  && result.request.revision === fixtureInput.revision
const integrityMatched = result.file.gitBlobId === expected.gitBlobId && result.file.contentSha256 === expected.contentSha256
const contentMatched = result.file.content === 'Hello World!\n'
const probePassed = result.conformance.status === 'passed' && identityMatched && integrityMatched && contentMatched
const snapshot = { schemaVersion: 'dsh.github-public-repository-file-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-integrity', status: integrityMatched ? 'passed' : 'failed' },
  { id: 'fixture-content', status: contentMatched ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `github-public-repository-file-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/github/read-public-repository-file.md',
  connectorId: 'github-public-repository-file',
  probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-file-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/github/public-repository-file/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, repository: result.request.repository, path: result.file.path, revision: result.request.revision, gitBlobId: result.file.gitBlobId, contentSha256: result.file.contentSha256, rateLimit: result.rateLimit, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

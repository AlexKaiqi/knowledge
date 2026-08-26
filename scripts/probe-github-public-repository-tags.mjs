import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { listPublicRepositoryTags } from '../connectors/github-public-repository-tags/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/github-public-repository-tags')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { owner: 'tamnd', repository: 'xiaohongshu-cli', maxTags: 200 }
const expectedTags = {
  'v0.1.0': '1508229cfa4b1437e0cb2e76b03dbfda42b23b4f',
  'v0.2.0': '96743ceff24452073b3571c1b07f6ce75bb223bb',
}

const startedAt = new Date()
const result = await listPublicRepositoryTags(fixtureInput)
const finishedAt = new Date()
const tagsByName = Object.fromEntries(result.tags.map((tag) => [tag.name, tag.commitSha]))
const expectedTagsCurrent = Object.entries(expectedTags).every(([name, sha]) => tagsByName[name] === sha)
const coverageExplicit = result.coverage.representation === 'bounded-tag-set'
  && result.coverage.maximumTags === fixtureInput.maxTags
  && result.coverage.tagSetComplete
  && !result.coverage.truncated
const probePassed = result.conformance.status === 'passed' && expectedTagsCurrent && coverageExplicit
const snapshot = { schemaVersion: 'dsh.github-public-repository-tags-snapshot/v1', fixture: { expectedTags }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'known-tags-current', status: expectedTagsCurrent ? 'passed' : 'failed' },
  { id: 'complete-bounded-tag-set', status: coverageExplicit ? 'passed' : 'failed' },
  { id: 'identity-fields-excluded', status: result.tags.every((tag) => Object.keys(tag).sort().join(',') === 'commitSha,name') ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `github-public-repository-tags-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/github/list-public-repository-tags.md',
  connectorId: 'github-public-repository-tags',
  probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-tags-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/github/public-repository-tags/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, tagCount: result.tags.length, tagSetComplete: result.coverage.tagSetComplete, requestsMade: result.coverage.requestsMade, expectedTagsCurrent, rateLimit: result.rateLimit, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

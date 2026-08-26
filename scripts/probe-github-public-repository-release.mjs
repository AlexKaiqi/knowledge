import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicRepositoryReleaseByTag } from '../connectors/github-public-repository-release/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/github-public-repository-release')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { owner: 'JoeanAmier', repository: 'XHS-Downloader', tagName: '2.7' }
const expectedRelease = {
  targetCommitish: 'master',
  name: 'XHS-Downloader V2.7',
  prerelease: false,
  immutable: false,
  createdAt: '2026-02-09T06:35:57.000Z',
  publishedAt: '2026-02-09T06:40:22.000Z',
  url: 'https://github.com/JoeanAmier/XHS-Downloader/releases/tag/2.7',
}
const expectedAssets = [
  ['XHS-Downloader_V2.7_macOS_ARM64.zip', 39976593, 'a434b04d5871fae5952d89ee5c2296d64d1ca9997592b4ddde6caba80539432f'],
  ['XHS-Downloader_V2.7_macOS_X64.zip', 41370295, 'a6be90092c1b4f84df9962b88793eef77050a5a1104d218da6ac52d4d6f0f531'],
  ['XHS-Downloader_V2.7_Windows_ARM64.zip', 12442504, 'af260a35e1ae5071d52cbcc53cbfe0740bdc612beb2089f0734448ca07a0006c'],
  ['XHS-Downloader_V2.7_Windows_X64.zip', 41013054, 'ff5e7b6355895d5d18232f5db69d5b08c7237720c2c8c57b1d9b5bde8fa40c99'],
]

const startedAt = new Date()
const result = await readPublicRepositoryReleaseByTag(fixtureInput)
const finishedAt = new Date()
const release = result.release
const identityMatched = release.tagName === fixtureInput.tagName
  && release.targetCommitish === expectedRelease.targetCommitish
  && release.name === expectedRelease.name
  && release.prerelease === expectedRelease.prerelease
  && release.immutable === expectedRelease.immutable
  && release.createdAt === expectedRelease.createdAt
  && release.publishedAt === expectedRelease.publishedAt
  && release.url === expectedRelease.url
const assetMap = new Map(release.assets.map((asset) => [asset.name, asset]))
const assetsMatched = release.assets.length === expectedAssets.length
  && release.assetCoverage.returnedCount === expectedAssets.length
  && release.assetCoverage.sha256Count === expectedAssets.length
  && expectedAssets.every(([name, sizeBytes, sha256]) => assetMap.get(name)?.sizeBytes === sizeBytes && assetMap.get(name)?.sha256 === sha256)
const serialized = JSON.stringify(result)
const minimized = !/(?:"author"|"uploader"|avatar|download_count|downloadCount|tarball|zipball|cookie|token)/i.test(serialized)
const notesBounded = release.notes.characterCount > 0 && [...release.notes.excerpt].length <= 4096 && /^[a-f0-9]{64}$/.test(release.notes.sha256)
const probePassed = result.conformance.status === 'passed' && identityMatched && assetsMatched && minimized && notesBounded
const snapshot = { schemaVersion: 'dsh.github-public-repository-release-snapshot/v1', fixture: { expectedRelease, expectedAssets }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-release-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-assets', status: assetsMatched ? 'passed' : 'failed' },
  { id: 'bounded-release-notes', status: notesBounded ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `github-public-repository-release-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/github/read-public-repository-release-by-tag.md',
  connectorId: 'github-public-repository-release',
  probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-release-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/github/public-repository-release/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({
  outcome: report.outcome,
  repository: result.repositoryUrl,
  tagName: release.tagName,
  assetCount: release.assets.length,
  sha256Count: release.assetCoverage.sha256Count,
  snapshotSha256: snapshotDigest,
  rateLimitRemaining: result.registryState.rateLimit.remaining,
  outputRoot,
}))
if (!probePassed) process.exitCode = 1

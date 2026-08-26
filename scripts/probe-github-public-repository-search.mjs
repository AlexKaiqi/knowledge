import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { searchPublicRepositories } from '../connectors/github-public-repository-search/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/github-public-repository-search')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { query: 'xiaohongshu-mcp in:name user:xpzouying', perPage: 5, page: 1 }
const expectedRepository = 'xpzouying/xiaohongshu-mcp'

const startedAt = new Date()
const result = await searchPublicRepositories(fixtureInput)
const finishedAt = new Date()
const targetFound = result.repositories.some((repository) => repository.fullName === expectedRepository)
const coverageExplicit = result.coverage.representation === 'ranked-page' && result.coverage.resultWindowLimit === 1000 && result.coverage.ecosystemComplete === false
const probePassed = result.conformance.status === 'passed' && targetFound && coverageExplicit
const snapshot = { schemaVersion: 'dsh.github-public-repository-search-snapshot/v1', fixture: { expectedRepository }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'known-repository-found', status: targetFound ? 'passed' : 'failed' },
  { id: 'coverage-boundary-explicit', status: coverageExplicit ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `github-public-repository-search-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/github/search-public-repositories.md',
  connectorId: 'github-public-repository-search',
  probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-search-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/github/public-repository-search/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, resultDigest: result.resultDigest, returnedCount: result.repositories.length, targetFound, rateLimit: result.rateLimit, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_DOCUMENT_ENTRIES, MAX_RESPONSE_BYTES, readRegisteredPublicFeed } from '../connectors/web-feed-reader/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/web-feed-reader-nodejs-releases')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { feedId: 'nodejs-releases', limit: 10 }
const expectedEntry = { title: 'Node.js 24.20.0 (LTS)', url: 'https://nodejs.org/en/blog/release/v24.20.0', publishedAt: '2026-08-26T14:29:42.000Z' }

function outputKeys(value, result = new Set()) {
  if (Array.isArray(value)) for (const item of value) outputKeys(item, result)
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { result.add(key.toLowerCase()); outputKeys(item, result) }
  return result
}

const startedAt = new Date()
const result = await readRegisteredPublicFeed(fixtureInput)
const finishedAt = new Date()
const matchedEntry = result.entries.some((entry) => entry.title === expectedEntry.title && entry.url === expectedEntry.url && entry.publishedAt === expectedEntry.publishedAt)
const identityMatched = result.source.id === 'nodejs-releases' && result.source.feedUrl === 'https://nodejs.org/en/feed/releases.xml' && result.feed.title === 'Node.js Blog: Releases' && result.feed.language === 'en'
const bounded = result.transport.receivedBytes <= MAX_RESPONSE_BYTES && result.coverage.documentEntryCount <= MAX_DOCUMENT_ENTRIES && result.entries.length <= fixtureInput.limit && result.coverage.returnedCount === result.entries.length
const forbiddenKeys = ['author', 'email', 'content', 'description', 'enclosure', 'rawxml', 'rawpayload']
const keys = outputKeys(result)
const minimized = forbiddenKeys.every((key) => !keys.has(key))
const passed = result.conformance.status === 'passed' && identityMatched && matchedEntry && bounded && minimized
const snapshot = { schemaVersion: 'dsh.web-feed-reader-snapshot/v1', fixture: { input: fixtureInput, expectedEntry }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex')
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `web-feed-reader-nodejs-releases-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/web-feeds/read-registered-public-feed.md',
  connectorId: 'web-feed-reader',
  probeDefinitionRef: 'repo:/probes/definitions/web-feed-reader-nodejs-releases-live.json',
  environment: 'production-public', level: 'live', outcome: passed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks: [...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })), { id: 'fixture-release-entry', status: matchedEntry ? 'passed' : 'failed' }, { id: 'data-minimization', status: minimized ? 'passed' : 'failed' }],
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/web-feeds/nodejs-releases/snapshot.json', sha256: snapshotSha256 }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText), writeFile(path.join(outputRoot, 'report.json'), stableJson(report))])
process.stdout.write(stableJson({ outcome: report.outcome, feedId: result.source.id, format: result.source.format, documentEntryCount: result.coverage.documentEntryCount, returnedCount: result.entries.length, feedDigest: result.feed.feedDigest, snapshotSha256, outputRoot }))
if (!passed) process.exitCode = 1

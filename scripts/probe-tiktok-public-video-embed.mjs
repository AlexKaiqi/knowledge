import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicVideoEmbed } from '../connectors/tiktok-public-video-embed/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/tiktok-public-video-embed')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { videoUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' }
const expected = { videoId: '6718335390845095173', canonicalUrl: fixtureInput.videoUrl, title: 'Scramble up ur name & I’ll try to guess it😍❤️ #foryoupage #petsoftiktok #aesthetic' }

const startedAt = new Date()
const result = await readPublicVideoEmbed(fixtureInput)
const finishedAt = new Date()
const descriptor = result.videoEmbed
const identityMatched = descriptor.videoId === expected.videoId && descriptor.canonicalUrl === expected.canonicalUrl
const descriptorMatched = descriptor.title === expected.title && descriptor.thumbnailWidth > 0 && descriptor.thumbnailHeight > 0
const minimized = !/(?:author|<blockquote|thumbnailUrl|thumbnail_url|metrics|comments|media|cookie|token|raw)/i.test(JSON.stringify(result))
const probePassed = result.conformance.status === 'passed' && identityMatched && descriptorMatched && minimized
const snapshot = { schemaVersion: 'dsh.tiktok-public-video-embed-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((item) => ({ id: item.id, status: item.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-descriptor', status: descriptorMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `tiktok-public-video-embed-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/tiktok/read-public-video-embed.md',
  connectorId: 'tiktok-public-video-embed',
  probeDefinitionRef: 'repo:/probes/definitions/tiktok-public-video-embed-live.json',
  environment: 'production-public', level: 'live', outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/tiktok/public-video-embed/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText), writeFile(path.join(outputRoot, 'report.json'), stableJson(report))])
process.stdout.write(stableJson({ outcome: report.outcome, ...descriptor, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

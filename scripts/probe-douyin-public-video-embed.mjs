import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicVideoEmbed } from '../connectors/douyin-public-video-embed/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/douyin-public-video-embed')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { videoId: '7601036371859459343' }
const expected = {
  title: '#中国机器人突破感知极限  #中国造机器人连微风都摸得出来了  #新质生产力中国行',
  width: 1080,
  height: 1920,
  playerUrl: 'https://open.douyin.com/player/video?vid=7601036371859459343&autoplay=0',
}

const startedAt = new Date()
const result = await readPublicVideoEmbed(fixtureInput)
const finishedAt = new Date()
const embed = result.videoEmbed
const identityMatched = embed.videoId === fixtureInput.videoId && embed.playerUrl === expected.playerUrl
const descriptorMatched = embed.title === expected.title && embed.width === expected.width && embed.height === expected.height
const serialized = JSON.stringify(result)
const minimized = !/(?:<iframe|iframe_code|log_id|author|statistics|digg|comment|media_url|cookie|token|raw)/i.test(serialized)
const probePassed = result.conformance.status === 'passed' && identityMatched && descriptorMatched && minimized
const snapshot = { schemaVersion: 'dsh.douyin-public-video-embed-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-descriptor', status: descriptorMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `douyin-public-video-embed-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/douyin/read-public-video-embed.md',
  connectorId: 'douyin-public-video-embed',
  probeDefinitionRef: 'repo:/probes/definitions/douyin-public-video-embed-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/douyin/public-video-embed/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, videoId: embed.videoId, title: embed.title, width: embed.width, height: embed.height, playerUrl: embed.playerUrl, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

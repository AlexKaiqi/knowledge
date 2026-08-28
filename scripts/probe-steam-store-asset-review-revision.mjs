import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamStoreAssetReviewRevision } from '../connectors/steam-store-asset-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'steam-store-asset-overview',
    url: 'https://partner.steamgames.com/doc/store/assets?l=english&language=english',
    assertions: ['Old dimensions are no longer accepted.', '920px x 430px', '462px x 174px', '1232px x 706px', '748px x 896px'],
  },
  {
    id: 'steam-store-graphical-assets',
    url: 'https://partner.steamgames.com/doc/store/assets/standard?l=english&language=english',
    assertions: ['at least 5 screenshots', '1920x1080 minimum', '16:9 aspect ratio'],
  },
  {
    id: 'steam-graphical-asset-rules',
    url: 'https://partner.steamgames.com/doc/store/assets/rules?l=english&language=english',
    assertions: ['limited to game artwork, the game name, and any official subtitle', 'readable product logo/name and have accurate dimensions', 'PG-13 appropriate artwork'],
  },
  {
    id: 'steam-store-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?l=english&language=english',
    assertions: ['screenshots must only contain gameplay', 'capsule images will need to include a readable product title or logo', 'Mark as ready for review'],
  },
]

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let current = value
  for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? 0xedb88320 ^ (current >>> 1) : current >>> 1
  return current >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii')
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([size, name, data, checksum])
}

function png(width, height, shade = 0) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  const row = Buffer.alloc(width + 1, shade)
  row[0] = 0
  const pixels = Buffer.alloc((width + 1) * height)
  for (let index = 0; index < height; index += 1) row.copy(pixels, index * row.length)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}

const definitions = [
  ['header-capsule', 'header.png', 920, 430],
  ['small-capsule', 'small.png', 462, 174],
  ['main-capsule', 'main.png', 1232, 706],
  ['vertical-capsule', 'vertical.png', 748, 896],
  ...Array.from({ length: 5 }, (_, index) => ['screenshot', `shot-${index + 1}.png`, 1920, 1080]),
]

const startedAt = new Date()
const sourceEvidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-assets-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const normalizedText = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!normalizedText.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  sourceEvidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-steam-assets-probe-'))
let prepared
try {
  const sourceDirectory = path.join(temporaryRoot, 'store-assets')
  await mkdir(sourceDirectory)
  for (const [index, [kind, assetPath, width, height]] of definitions.entries()) await writeFile(path.join(sourceDirectory, assetPath), png(width, height, kind === 'screenshot' ? index + 1 : 0))
  const input = {
    gameRef: 'game:probe-demo',
    sourceRevisionRef: 'fixture:steam-store-assets-v1',
    sourceDirectory: 'store-assets',
    assets: definitions.map(([kind, assetPath]) => ({ kind, path: assetPath })),
    rightsBasisRefs: ['fixture:generated-owned-assets'],
  }
  prepared = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: temporaryRoot, now: () => new Date('2026-08-27T04:00:00Z') })
  const replay = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: temporaryRoot, now: () => new Date('2026-08-28T04:00:00Z') })
  if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('valid asset replay mismatch')
  if (!prepared.manualReview.required || !prepared.manualReview.checks.every((check) => check.status === 'pending')) throw new Error('manual review boundary mismatch')
  if (prepared.uploaded || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')
  if (JSON.stringify(prepared).includes(temporaryRoot)) throw new Error('public result leaked local workspace path')
  for (const asset of prepared.assets) {
    const bytes = await readFile(path.join(sourceDirectory, asset.path))
    if (asset.sha256 !== `sha256:${sha256(bytes)}`) throw new Error(`asset digest mismatch: ${asset.path}`)
  }
  await writeFile(path.join(sourceDirectory, 'header.png'), png(460, 215))
  const oldDimension = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: temporaryRoot })
  if (!oldDimension.preflight.blockers.some((blocker) => blocker.code === 'capsule-dimensions-mismatch')) throw new Error('old capsule dimension was not blocked')
  const missingScreenshot = await prepareSteamStoreAssetReviewRevision({ ...input, assets: input.assets.slice(0, -1) }, { workspaceRoot: temporaryRoot })
  if (!missingScreenshot.preflight.blockers.some((blocker) => blocker.code === 'minimum-screenshot-count')) throw new Error('screenshot minimum was not blocked')
  await writeFile(path.join(sourceDirectory, 'shot-2.png'), png(1920, 1080, 5))
  const duplicateScreenshot = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: temporaryRoot })
  if (!duplicateScreenshot.preflight.blockers.some((blocker) => blocker.code === 'duplicate-screenshot-content')) throw new Error('duplicate screenshot bytes were not blocked')
  await symlink(path.join(sourceDirectory, 'shot-1.png'), path.join(sourceDirectory, 'alias.png'))
  const linkedAssets = input.assets.map((asset) => asset.path === 'shot-1.png' ? { kind: 'screenshot', path: 'alias.png' } : asset)
  const linked = await prepareSteamStoreAssetReviewRevision({ ...input, assets: linkedAssets }, { workspaceRoot: temporaryRoot })
  if (!linked.preflight.blockers.some((blocker) => blocker.code === 'symlink-not-allowed')) throw new Error('symlink was not blocked')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/steam/prepare-store-asset-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(prepared)) throw new Error(`Steam asset output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/steam/store-asset-review-revision/snapshot.json')
const reportPath = path.join(repositoryRoot, 'knowledge/verifications/steam/store-asset-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'generated-valid-png-store-asset-set', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-store-asset-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-store-asset-review-revision.md',
  connectorId: 'steam-store-asset-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-store-asset-review-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-dimensions', status: 'passed' },
    { id: 'current-official-screenshot-minimum', status: 'passed' },
    { id: 'streamed-file-digests', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'dimension-count-duplicate-and-symlink-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-upload-boundary', status: 'passed' }
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/store-asset-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

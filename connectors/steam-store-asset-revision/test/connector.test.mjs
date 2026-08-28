import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareSteamStoreAssetReviewRevision } from '../src/index.mjs'

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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const definitions = [
  ['header-capsule', 'header.png', 920, 430],
  ['small-capsule', 'small.png', 462, 174],
  ['main-capsule', 'main.png', 1232, 706],
  ['vertical-capsule', 'vertical.png', 748, 896],
  ...Array.from({ length: 5 }, (_, index) => ['screenshot', `shot-${index + 1}.png`, 1920, 1080]),
]

const input = {
  gameRef: 'game:demo',
  sourceRevisionRef: 'git:demo@abc123',
  sourceDirectory: 'store-assets',
  assets: definitions.map(([kind, assetPath]) => ({ kind, path: assetPath })),
  rightsBasisRefs: ['rights:owner-authored'],
}

async function workspace(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-steam-assets-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'store-assets'))
  for (const [index, [kind, assetPath, width, height]] of definitions.entries()) await writeFile(path.join(root, 'store-assets', assetPath), png(width, height, kind === 'screenshot' ? index + 1 : 0))
  return root
}

const at = (iso) => () => new Date(iso)

test('freezes the current required store asset dimensions into a deterministic human-review revision', async (context) => {
  const root = await workspace(context)
  const first = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: root, now: at('2026-08-27T04:00:00Z') })
  const replay = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: root, now: at('2026-08-28T04:00:00Z') })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.revisionHash, replay.revisionHash)
  assert.deepEqual(first.summary, { assetCount: 9, screenshotCount: 5, totalBytes: first.summary.totalBytes })
  assert.equal(first.assets.find((asset) => asset.kind === 'header-capsule').width, 920)
  assert.equal(first.assets.filter((asset) => asset.kind === 'screenshot').every((asset) => asset.width * 9 === asset.height * 16), true)
  assert.equal(new Set(first.assets.filter((asset) => asset.kind === 'screenshot').map((asset) => asset.sha256)).size, 5)
  assert.equal(first.assets.every((asset) => asset.format === 'png' && /^sha256:[0-9a-f]{64}$/.test(asset.sha256)), true)
  assert.equal(first.manualReview.required, true)
  assert.equal(first.manualReview.checks.every((check) => check.status === 'pending'), true)
  assert.equal(first.uploaded, false)
  assert.equal(first.markedReadyForReview, false)
  assert.equal(first.released, false)
  assert.equal(first.executionAuthorized, false)
  assert.equal(JSON.stringify(first).includes(root), false)
})

test('blocks old capsule dimensions and insufficient screenshot sets', async (context) => {
  const root = await workspace(context)
  await writeFile(path.join(root, 'store-assets/header.png'), png(460, 215))
  const result = await prepareSteamStoreAssetReviewRevision({ ...input, assets: input.assets.filter((asset) => asset.path !== 'shot-5.png') }, { workspaceRoot: root })
  assert.equal(result.status, 'blocked')
  assert.equal(result.revisionHash, null)
  assert.deepEqual(result.assets, [])
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'capsule-dimensions-mismatch'), true)
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'minimum-screenshot-count'), true)
})

test('blocks byte-identical duplicate screenshots instead of satisfying the minimum by copies', async (context) => {
  const root = await workspace(context)
  await writeFile(path.join(root, 'store-assets/shot-2.png'), png(1920, 1080, 5))
  const result = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: root })
  assert.equal(result.status, 'blocked')
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'duplicate-screenshot-content' && blocker.path === 'shot-2.png' && blocker.duplicateOf === 'shot-1.png'), true)
})

test('blocks non-16:9 screenshots, symlinks and secret-like asset names', async (context) => {
  const root = await workspace(context)
  await writeFile(path.join(root, 'store-assets/shot-1.png'), png(1920, 1200))
  await symlink(path.join(root, 'store-assets/shot-2.png'), path.join(root, 'store-assets/alias.png'))
  await writeFile(path.join(root, 'store-assets/.env.png'), png(1920, 1080))
  const assets = input.assets
    .filter((asset) => !['shot-2.png', 'shot-3.png'].includes(asset.path))
    .concat([{ kind: 'screenshot', path: 'alias.png' }, { kind: 'screenshot', path: '.env.png' }])
  const result = await prepareSteamStoreAssetReviewRevision({ ...input, assets }, { workspaceRoot: root })
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'screenshot-dimensions-mismatch'), true)
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'symlink-not-allowed'), true)
  assert.equal(result.preflight.blockers.some((blocker) => blocker.code === 'secret-like-filename'), true)
})

test('changing image bytes changes the revision while unsafe input is rejected', async (context) => {
  const root = await workspace(context)
  const before = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: root })
  await writeFile(path.join(root, 'store-assets/shot-5.png'), png(1920, 1080, 96))
  const after = await prepareSteamStoreAssetReviewRevision(input, { workspaceRoot: root })
  assert.notEqual(before.assets.find((asset) => asset.path === 'shot-5.png').sha256, after.assets.find((asset) => asset.path === 'shot-5.png').sha256)
  assert.notEqual(before.revisionHash, after.revisionHash)
  await assert.rejects(() => prepareSteamStoreAssetReviewRevision({ ...input, sourceDirectory: '../outside' }, { workspaceRoot: root }), /safe POSIX-relative/)
  await assert.rejects(() => prepareSteamStoreAssetReviewRevision({ ...input, upload: true }, { workspaceRoot: root }), /unsupported fields/)
  const unavailable = await prepareSteamStoreAssetReviewRevision({ ...input, sourceDirectory: 'missing' }, { workspaceRoot: root })
  assert.equal(unavailable.preflight.blockers.some((blocker) => blocker.code === 'source-directory-unavailable'), true)
})

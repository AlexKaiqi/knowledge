import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'sourceDirectory', 'assets', 'rightsBasisRefs'])
const ASSET_KEYS = new Set(['kind', 'path'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const SAFE_RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\/\/)[^\0]+$/
const SECRET_NAMES = [
  /^\.env(?:\..+)?$/i,
  /^\.credentials\.ya?ml$/i,
  /^(?:credentials|cookies|auth)\.json$/i,
  /\.(?:pem|key|p12|pfx|keystore)$/i,
]
const CAPSULES = new Map([
  ['header-capsule', { width: 920, height: 430 }],
  ['small-capsule', { width: 462, height: 174 }],
  ['main-capsule', { width: 1232, height: 706 }],
  ['vertical-capsule', { width: 748, height: 896 }],
])
const KINDS = new Set([...CAPSULES.keys(), 'screenshot'])
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

async function hashFile(target) {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(target)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`))
  })
}

function assertRelative(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500 || !SAFE_RELATIVE.test(value) || path.posix.isAbsolute(value)) throw new Error(`${name} must be a safe POSIX-relative path`)
  const normalized = path.posix.normalize(value)
  if (normalized === '.' || normalized.startsWith('../')) throw new Error(`${name} must stay inside its root`)
  return normalized
}

function assertRef(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

export function normalizeSteamStoreAssetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.assets) || input.assets.length < 1 || input.assets.length > 100) throw new Error('assets must contain 1..100 items')
  const assets = input.assets.map((asset, index) => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error(`assets[${index}] must be an object`)
    const extra = Object.keys(asset).filter((key) => !ASSET_KEYS.has(key))
    if (extra.length > 0) throw new Error(`assets[${index}] contains unsupported fields: ${extra.join(', ')}`)
    if (!KINDS.has(asset.kind)) throw new Error(`assets[${index}].kind is unsupported`)
    return { kind: asset.kind, path: assertRelative(asset.path, `assets[${index}].path`) }
  }).sort((left, right) => left.kind.localeCompare(right.kind) || left.path.localeCompare(right.path))
  if (new Set(assets.map((asset) => asset.path)).size !== assets.length) throw new Error('asset paths must be unique')
  if (!Array.isArray(input.rightsBasisRefs) || input.rightsBasisRefs.length < 1 || input.rightsBasisRefs.length > 20) throw new Error('rightsBasisRefs must contain 1..20 references')
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: assertRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    sourceDirectory: assertRelative(input.sourceDirectory, 'sourceDirectory'),
    assets,
    rightsBasisRefs: [...new Set(input.rightsBasisRefs.map((value, index) => assertRef(value, `rightsBasisRefs[${index}]`)))].sort(),
  }
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

async function readExactly(handle, length, position) {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buffer, 0, length, position)
  if (bytesRead !== length) throw new Error('truncated-image-header')
  return buffer
}

async function readImageDimensions(target) {
  const handle = await open(target, 'r')
  try {
    const prefix = await readExactly(handle, 24, 0)
    if (prefix.subarray(0, 8).equals(PNG_SIGNATURE)) {
      if (prefix.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('invalid-png-header')
      return { format: 'png', width: prefix.readUInt32BE(16), height: prefix.readUInt32BE(20) }
    }
    if (prefix[0] !== 0xff || prefix[1] !== 0xd8) throw new Error('unsupported-image-format')
    let position = 2
    const metadata = await handle.stat()
    while (position + 4 <= metadata.size) {
      let markerStart = await readExactly(handle, 2, position)
      while (markerStart[0] !== 0xff && position + 2 < metadata.size) {
        position += 1
        markerStart = await readExactly(handle, 2, position)
      }
      let marker = markerStart[1]
      position += 2
      while (marker === 0xff && position < metadata.size) {
        marker = (await readExactly(handle, 1, position))[0]
        position += 1
      }
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const length = (await readExactly(handle, 2, position)).readUInt16BE(0)
      if (length < 2 || position + length > metadata.size) throw new Error('invalid-jpeg-segment')
      if (SOF_MARKERS.has(marker)) {
        if (length < 7) throw new Error('invalid-jpeg-frame')
        const frame = await readExactly(handle, 5, position + 2)
        return { format: 'jpeg', width: frame.readUInt16BE(3), height: frame.readUInt16BE(1) }
      }
      position += length
    }
    throw new Error('jpeg-dimensions-not-found')
  } finally {
    await handle.close()
  }
}

function manualReview() {
  return {
    required: true,
    checks: [
      { id: 'capsule-readable-product-name', status: 'pending' },
      { id: 'capsule-base-content-only', status: 'pending' },
      { id: 'capsule-pg13-artwork', status: 'pending' },
      { id: 'screenshots-gameplay-only', status: 'pending' },
      { id: 'screenshots-age-suitability-marking', status: 'pending' },
      { id: 'rights-and-launch-content', status: 'pending' },
    ],
  }
}

function resultBase(input, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-store-asset-review-revision/v1',
    gameRef: input.gameRef,
    sourceRevisionRef: input.sourceRevisionRef,
    rightsBasisRefs: input.rightsBasisRefs,
    manualReview: manualReview(),
    uploaded: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt,
  }
}

export async function prepareSteamStoreAssetReviewRevision(input, {
  workspaceRoot,
  now = () => new Date(),
  maxAssets = 50,
  maxSingleAssetBytes = 50 * 1024 * 1024,
  maxTotalBytes = 512 * 1024 * 1024,
} = {}) {
  const normalized = normalizeSteamStoreAssetInput(input)
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length < 1) throw new Error('workspaceRoot is required')
  for (const [name, value] of Object.entries({ maxAssets, maxSingleAssetBytes, maxTotalBytes })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`)
  }
  const preparedAt = now().toISOString()
  const blockers = []
  const checks = [
    { id: 'required-capsule-set', status: 'passed' },
    { id: 'minimum-screenshot-count', status: 'passed' },
    { id: 'screenshot-byte-uniqueness', status: 'passed' },
    { id: 'image-header-and-dimensions', status: 'passed' },
    { id: 'workspace-boundary', status: 'passed' },
    { id: 'asset-budgets', status: 'passed' },
  ]
  const counts = new Map()
  for (const asset of normalized.assets) counts.set(asset.kind, (counts.get(asset.kind) ?? 0) + 1)
  for (const kind of CAPSULES.keys()) {
    const count = counts.get(kind) ?? 0
    if (count !== 1) blockers.push({ code: 'required-capsule-count', kind, expected: 1, observed: count })
  }
  const screenshotCount = counts.get('screenshot') ?? 0
  if (screenshotCount < 5) blockers.push({ code: 'minimum-screenshot-count', expectedMinimum: 5, observed: screenshotCount })
  if (normalized.assets.length > maxAssets) blockers.push({ code: 'asset-count-budget-exceeded', maximum: maxAssets, observed: normalized.assets.length })

  const canonicalWorkspace = await realpath(workspaceRoot)
  const unresolvedSource = path.resolve(canonicalWorkspace, ...normalized.sourceDirectory.split('/'))
  let sourceMetadata
  let canonicalSource
  try {
    sourceMetadata = await lstat(unresolvedSource)
    if (sourceMetadata.isSymbolicLink()) blockers.push({ code: 'source-directory-symlink' })
    if (!sourceMetadata.isDirectory()) blockers.push({ code: 'source-directory-not-directory' })
    canonicalSource = await realpath(unresolvedSource)
    if (!inside(canonicalWorkspace, canonicalSource)) blockers.push({ code: 'source-directory-outside-workspace' })
  } catch {
    blockers.push({ code: 'source-directory-unavailable' })
  }

  const observed = []
  let totalBytes = 0
  if (canonicalSource && blockers.every((blocker) => !blocker.code.startsWith('source-directory'))) {
    for (const asset of normalized.assets) {
      const target = path.resolve(canonicalSource, ...asset.path.split('/'))
      let metadata
      try {
        metadata = await lstat(target)
      } catch {
        blockers.push({ code: 'asset-missing', path: asset.path })
        continue
      }
      if (metadata.isSymbolicLink()) {
        blockers.push({ code: 'symlink-not-allowed', path: asset.path })
        continue
      }
      if (!metadata.isFile()) {
        blockers.push({ code: 'regular-file-required', path: asset.path })
        continue
      }
      const canonicalTarget = await realpath(target)
      if (!inside(canonicalSource, canonicalTarget)) {
        blockers.push({ code: 'asset-outside-source', path: asset.path })
        continue
      }
      if (SECRET_NAMES.some((pattern) => pattern.test(path.posix.basename(asset.path)))) {
        blockers.push({ code: 'secret-like-filename', path: asset.path })
        continue
      }
      totalBytes += metadata.size
      if (metadata.size > maxSingleAssetBytes) blockers.push({ code: 'single-asset-budget-exceeded', path: asset.path, maximumBytes: maxSingleAssetBytes, observedBytes: metadata.size })
      let dimensions
      try {
        dimensions = await readImageDimensions(canonicalTarget)
      } catch (error) {
        blockers.push({ code: 'invalid-image-header', path: asset.path, detail: error.message })
        continue
      }
      const expected = CAPSULES.get(asset.kind)
      if (expected && (dimensions.width !== expected.width || dimensions.height !== expected.height)) {
        blockers.push({ code: 'capsule-dimensions-mismatch', path: asset.path, kind: asset.kind, expected, observed: { width: dimensions.width, height: dimensions.height } })
      }
      if (asset.kind === 'screenshot' && (dimensions.width < 1920 || dimensions.height < 1080 || dimensions.width * 9 !== dimensions.height * 16)) {
        blockers.push({ code: 'screenshot-dimensions-mismatch', path: asset.path, expected: { minimumWidth: 1920, minimumHeight: 1080, aspectRatio: '16:9' }, observed: { width: dimensions.width, height: dimensions.height } })
      }
      const sha256 = await hashFile(canonicalTarget)
      const after = await lstat(canonicalTarget)
      if (metadata.dev !== after.dev || metadata.ino !== after.ino || metadata.size !== after.size || metadata.mtimeMs !== after.mtimeMs) {
        blockers.push({ code: 'asset-mutated-during-read', path: asset.path })
        continue
      }
      observed.push({ kind: asset.kind, path: asset.path, format: dimensions.format, width: dimensions.width, height: dimensions.height, sizeBytes: metadata.size, sha256 })
    }
  }
  const screenshotDigests = new Map()
  for (const asset of observed.filter((item) => item.kind === 'screenshot')) {
    const duplicateOf = screenshotDigests.get(asset.sha256)
    if (duplicateOf) blockers.push({ code: 'duplicate-screenshot-content', path: asset.path, duplicateOf })
    else screenshotDigests.set(asset.sha256, asset.path)
  }
  if (totalBytes > maxTotalBytes) blockers.push({ code: 'total-asset-budget-exceeded', maximumBytes: maxTotalBytes, observedBytes: totalBytes })
  for (const check of checks) {
    if (check.id === 'required-capsule-set' && blockers.some((item) => item.code === 'required-capsule-count')) check.status = 'failed'
    if (check.id === 'minimum-screenshot-count' && blockers.some((item) => item.code === 'minimum-screenshot-count')) check.status = 'failed'
    if (check.id === 'screenshot-byte-uniqueness' && blockers.some((item) => item.code === 'duplicate-screenshot-content')) check.status = 'failed'
    if (check.id === 'image-header-and-dimensions' && blockers.some((item) => ['invalid-image-header', 'capsule-dimensions-mismatch', 'screenshot-dimensions-mismatch'].includes(item.code))) check.status = 'failed'
    if (check.id === 'workspace-boundary' && blockers.some((item) => ['source-directory-unavailable', 'source-directory-symlink', 'source-directory-not-directory', 'source-directory-outside-workspace', 'asset-missing', 'symlink-not-allowed', 'regular-file-required', 'asset-outside-source', 'secret-like-filename', 'asset-mutated-during-read'].includes(item.code))) check.status = 'failed'
    if (check.id === 'asset-budgets' && blockers.some((item) => item.code.includes('budget-exceeded'))) check.status = 'failed'
  }
  const base = resultBase(normalized, preparedAt)
  if (blockers.length > 0) {
    return {
      ...base,
      status: 'blocked',
      revisionHash: null,
      assets: [],
      summary: { assetCount: 0, screenshotCount, totalBytes },
      preflight: { checks, blockers: blockers.slice(0, 50) },
    }
  }
  const assets = observed.sort((left, right) => left.kind.localeCompare(right.kind) || left.path.localeCompare(right.path))
  const revisionPayload = {
    schemaVersion: 'dsh.steam-store-asset-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    rightsBasisRefs: normalized.rightsBasisRefs,
    assets,
  }
  return {
    ...base,
    status: 'ready-for-human-review',
    revisionHash: digestText(stableStringify(revisionPayload)),
    assets,
    summary: { assetCount: assets.length, screenshotCount, totalBytes },
    preflight: { checks, blockers: [] },
  }
}

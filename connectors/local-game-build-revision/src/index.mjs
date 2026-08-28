import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'

const INPUT_KEYS = new Set(['gameRef', 'version', 'target', 'releaseLane', 'visibilityIntent', 'sourceDirectory', 'entrypoints', 'sourceRevisionRef', 'rightsBasisRefs', 'releaseNotesRef'])
const TARGETS = new Set(['desktop-portable', 'steam-content-root', 'itch-portable', 'web-build'])
const LANES = new Set(['internal', 'beta', 'release-candidate', 'production'])
const VISIBILITIES = new Set(['owner-only', 'restricted', 'public'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const SAFE_RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\/\/)[^\0]+$/
const SECRET_NAMES = [
  /^\.env(?:\..+)?$/i,
  /^\.credentials\.ya?ml$/i,
  /^(?:id_rsa|id_ed25519)$/i,
  /^(?:credentials|cookies|auth)\.json$/i,
  /\.(?:pem|key|p12|pfx|keystore)$/i,
]

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

export function normalizeGameBuildInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (typeof input.version !== 'string' || input.version.trim().length < 1 || input.version.trim().length > 100) throw new Error('version is required and bounded')
  if (!TARGETS.has(input.target)) throw new Error('target is unsupported')
  if (!LANES.has(input.releaseLane)) throw new Error('releaseLane is unsupported')
  if (!VISIBILITIES.has(input.visibilityIntent)) throw new Error('visibilityIntent is unsupported')
  const sourceDirectory = assertRelative(input.sourceDirectory, 'sourceDirectory')
  if (!Array.isArray(input.entrypoints) || input.entrypoints.length > 20) throw new Error('entrypoints must contain at most 20 paths')
  const entrypoints = input.entrypoints.map((value, index) => assertRelative(value, `entrypoints[${index}]`)).sort()
  if (new Set(entrypoints).size !== entrypoints.length) throw new Error('entrypoints must be unique')
  if (['desktop-portable', 'itch-portable'].includes(input.target) && entrypoints.length < 1) throw new Error(`${input.target} requires at least one entrypoint`)
  if (input.target === 'web-build' && !entrypoints.includes('index.html')) throw new Error('web-build requires index.html as an entrypoint')
  if (!Array.isArray(input.rightsBasisRefs) || input.rightsBasisRefs.length < 1 || input.rightsBasisRefs.length > 20) throw new Error('rightsBasisRefs must contain 1..20 references')
  const rightsBasisRefs = [...new Set(input.rightsBasisRefs.map((value, index) => assertRef(value, `rightsBasisRefs[${index}]`)))].sort()
  return {
    gameRef: input.gameRef,
    version: input.version.trim(),
    target: input.target,
    releaseLane: input.releaseLane,
    visibilityIntent: input.visibilityIntent,
    sourceDirectory,
    entrypoints,
    sourceRevisionRef: assertRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    rightsBasisRefs,
    ...(input.releaseNotesRef === undefined ? {} : { releaseNotesRef: assertRef(input.releaseNotesRef, 'releaseNotesRef') }),
  }
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function blockedResult(input, blockers, checks, observed = {}) {
  return {
    schemaVersion: 'dsh.game-build-revision/v1',
    status: 'blocked',
    revisionHash: null,
    gameRef: input.gameRef,
    version: input.version,
    target: input.target,
    releaseLane: input.releaseLane,
    visibilityIntent: input.visibilityIntent,
    sourceRevisionRef: input.sourceRevisionRef,
    rightsBasisRefs: input.rightsBasisRefs,
    ...(input.releaseNotesRef ? { releaseNotesRef: input.releaseNotesRef } : {}),
    entrypoints: input.entrypoints,
    artifacts: [],
    summary: { fileCount: observed.fileCount ?? 0, totalBytes: observed.totalBytes ?? 0 },
    preflight: { checks, blockers: blockers.slice(0, 20) },
    uploaded: false,
    executionAuthorized: false,
    preparedAt: observed.preparedAt,
  }
}

export async function prepareLocalGameBuildRevision(input, {
  workspaceRoot,
  now = () => new Date(),
  maxFiles = 20_000,
  maxTotalBytes = 64 * 1024 * 1024 * 1024,
  maxSingleFileBytes = 32 * 1024 * 1024 * 1024,
} = {}) {
  const normalized = normalizeGameBuildInput(input)
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length < 1) throw new Error('workspaceRoot is required by the Connector')
  for (const [name, value] of Object.entries({ maxFiles, maxTotalBytes, maxSingleFileBytes })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`)
  }
  const preparedAt = now().toISOString()
  const checks = [
    { id: 'workspace-boundary', status: 'passed' },
    { id: 'regular-files-only', status: 'passed' },
    { id: 'secret-like-filenames-absent', status: 'passed' },
    { id: 'artifact-budget', status: 'passed' },
    { id: 'entrypoints-present', status: 'passed' },
    { id: 'nonempty-build', status: 'passed' },
  ]
  const fail = (id) => { const check = checks.find((item) => item.id === id); if (check) check.status = 'failed' }
  const blockers = []
  let canonicalWorkspace
  try {
    canonicalWorkspace = await realpath(workspaceRoot)
  } catch {
    fail('workspace-boundary')
    blockers.push({ code: 'workspace-unavailable' })
    return blockedResult(normalized, blockers, checks, { preparedAt })
  }
  const unresolvedSource = path.resolve(canonicalWorkspace, ...normalized.sourceDirectory.split('/'))
  let sourceInfo
  let canonicalSource
  try {
    sourceInfo = await lstat(unresolvedSource)
    canonicalSource = await realpath(unresolvedSource)
  } catch {
    fail('workspace-boundary')
    blockers.push({ code: 'source-directory-unavailable' })
    return blockedResult(normalized, blockers, checks, { preparedAt })
  }
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory() || !inside(canonicalWorkspace, canonicalSource)) {
    fail('workspace-boundary')
    blockers.push({ code: sourceInfo.isSymbolicLink() ? 'source-directory-symlink' : !sourceInfo.isDirectory() ? 'source-not-directory' : 'source-directory-escape' })
    return blockedResult(normalized, blockers, checks, { preparedAt })
  }

  const discovered = []
  let totalBytes = 0
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(canonicalSource, absolute).split(path.sep).join('/')
      if (entry.isSymbolicLink()) {
        fail('regular-files-only')
        blockers.push({ code: 'symlink-not-allowed', path: relative })
        continue
      }
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) {
        fail('regular-files-only')
        blockers.push({ code: 'special-file-not-allowed', path: relative })
        continue
      }
      if (SECRET_NAMES.some((pattern) => pattern.test(entry.name))) {
        fail('secret-like-filenames-absent')
        blockers.push({ code: 'secret-like-filename', path: relative })
        continue
      }
      const metadata = await lstat(absolute)
      const canonicalFile = await realpath(absolute)
      if (metadata.isSymbolicLink() || !metadata.isFile() || !inside(canonicalSource, canonicalFile)) {
        fail(metadata.isSymbolicLink() || !inside(canonicalSource, canonicalFile) ? 'workspace-boundary' : 'regular-files-only')
        blockers.push({ code: metadata.isSymbolicLink() ? 'symlink-not-allowed' : !metadata.isFile() ? 'special-file-not-allowed' : 'file-escape', path: relative })
        continue
      }
      discovered.push({ absolute, path: relative, sizeBytes: metadata.size, entrypoint: normalized.entrypoints.includes(relative) })
      totalBytes += metadata.size
      if (metadata.size > maxSingleFileBytes || discovered.length > maxFiles || totalBytes > maxTotalBytes) fail('artifact-budget')
    }
  }
  await walk(canonicalSource)
  if (discovered.length === 0) {
    fail('nonempty-build')
    blockers.push({ code: 'build-empty' })
  }
  if (checks.find((item) => item.id === 'artifact-budget').status === 'failed') blockers.push({ code: 'artifact-budget-exceeded' })
  const discoveredPaths = new Set(discovered.map((item) => item.path))
  for (const entrypoint of normalized.entrypoints) {
    if (!discoveredPaths.has(entrypoint)) {
      fail('entrypoints-present')
      blockers.push({ code: 'entrypoint-missing', path: entrypoint })
    }
  }
  if (blockers.length > 0) return blockedResult(normalized, blockers, checks, { fileCount: discovered.length, totalBytes, preparedAt })

  const artifacts = []
  for (const item of discovered) {
    artifacts.push({ path: item.path, sizeBytes: item.sizeBytes, sha256: await hashFile(item.absolute), entrypoint: item.entrypoint })
  }
  const revisionPayload = {
    schemaVersion: 'dsh.game-build-revision/v1',
    gameRef: normalized.gameRef,
    version: normalized.version,
    target: normalized.target,
    releaseLane: normalized.releaseLane,
    visibilityIntent: normalized.visibilityIntent,
    sourceRevisionRef: normalized.sourceRevisionRef,
    rightsBasisRefs: normalized.rightsBasisRefs,
    ...(normalized.releaseNotesRef ? { releaseNotesRef: normalized.releaseNotesRef } : {}),
    entrypoints: normalized.entrypoints,
    artifacts,
  }
  return {
    ...revisionPayload,
    status: 'ready',
    revisionHash: digestText(stableStringify(revisionPayload)),
    summary: { fileCount: artifacts.length, totalBytes },
    preflight: { checks, blockers: [] },
    uploaded: false,
    executionAuthorized: false,
    preparedAt,
  }
}

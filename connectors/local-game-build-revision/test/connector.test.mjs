import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareLocalGameBuildRevision } from '../src/index.mjs'

const input = {
  gameRef: 'game:demo',
  version: '0.1.0',
  target: 'desktop-portable',
  releaseLane: 'release-candidate',
  visibilityIntent: 'restricted',
  sourceDirectory: 'build',
  entrypoints: ['demo.exe'],
  sourceRevisionRef: 'git:demo@abc123',
  rightsBasisRefs: ['rights:owner-authored'],
  releaseNotesRef: 'workspace:release-notes.md',
}

async function workspace(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-game-build-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'build'))
  await writeFile(path.join(root, 'build/demo.exe'), 'demo executable\n')
  await writeFile(path.join(root, 'build/data.pck'), 'game data\n')
  return root
}

const at = (iso) => () => new Date(iso)

test('freezes real file bytes into a deterministic relative manifest without authorizing upload', async (context) => {
  const root = await workspace(context)
  const first = await prepareLocalGameBuildRevision(input, { workspaceRoot: root, now: at('2026-08-27T03:00:00Z') })
  const replay = await prepareLocalGameBuildRevision(input, { workspaceRoot: root, now: at('2026-08-28T03:00:00Z') })
  assert.equal(first.status, 'ready')
  assert.equal(first.revisionHash, replay.revisionHash)
  assert.deepEqual(first.artifacts.map((item) => item.path), ['data.pck', 'demo.exe'])
  assert.equal(first.artifacts.find((item) => item.path === 'demo.exe').entrypoint, true)
  assert.equal(first.artifacts.every((item) => /^sha256:[0-9a-f]{64}$/.test(item.sha256)), true)
  assert.equal(first.uploaded, false)
  assert.equal(first.executionAuthorized, false)
  assert.equal(JSON.stringify(first).includes(root), false)
})

test('changing one byte changes both the artifact digest and revision hash', async (context) => {
  const root = await workspace(context)
  const before = await prepareLocalGameBuildRevision(input, { workspaceRoot: root })
  await writeFile(path.join(root, 'build/data.pck'), 'changed game data\n')
  const after = await prepareLocalGameBuildRevision(input, { workspaceRoot: root })
  assert.notEqual(before.artifacts.find((item) => item.path === 'data.pck').sha256, after.artifacts.find((item) => item.path === 'data.pck').sha256)
  assert.notEqual(before.revisionHash, after.revisionHash)
})

test('blocks secret-like files, missing entrypoints and artifact budgets', async (context) => {
  const root = await workspace(context)
  await writeFile(path.join(root, 'build/.env.production'), 'TOKEN=do-not-read\n')
  const secret = await prepareLocalGameBuildRevision(input, { workspaceRoot: root })
  assert.equal(secret.status, 'blocked')
  assert.equal(secret.revisionHash, null)
  assert.equal(secret.preflight.blockers.some((item) => item.code === 'secret-like-filename'), true)
  const missing = await prepareLocalGameBuildRevision({ ...input, entrypoints: ['missing.exe'] }, { workspaceRoot: root })
  assert.equal(missing.preflight.blockers.some((item) => item.code === 'entrypoint-missing'), true)
  const budget = await prepareLocalGameBuildRevision(input, { workspaceRoot: root, maxFiles: 1 })
  assert.equal(budget.preflight.blockers.some((item) => item.code === 'artifact-budget-exceeded'), true)
})

test('blocks source and nested symlinks instead of following them', async (context) => {
  const root = await workspace(context)
  await symlink(path.join(root, 'build'), path.join(root, 'linked-build'))
  const linkedSource = await prepareLocalGameBuildRevision({ ...input, sourceDirectory: 'linked-build' }, { workspaceRoot: root })
  assert.equal(linkedSource.preflight.blockers[0].code, 'source-directory-symlink')

  await symlink(path.join(root, 'build/data.pck'), path.join(root, 'build/alias.pck'))
  const nested = await prepareLocalGameBuildRevision(input, { workspaceRoot: root })
  assert.equal(nested.preflight.blockers.some((item) => item.code === 'symlink-not-allowed' && item.path === 'alias.pck'), true)
})

test('web targets require index.html and unsafe paths or undeclared fields are rejected', async (context) => {
  const root = await workspace(context)
  await assert.rejects(() => prepareLocalGameBuildRevision({ ...input, target: 'web-build' }, { workspaceRoot: root }), /index.html/)
  await assert.rejects(() => prepareLocalGameBuildRevision({ ...input, sourceDirectory: '../outside' }, { workspaceRoot: root }), /safe POSIX-relative/)
  await assert.rejects(() => prepareLocalGameBuildRevision({ ...input, workspaceRoot: '/tmp' }, { workspaceRoot: root }), /unsupported fields/)
  await assert.rejects(() => prepareLocalGameBuildRevision(input, { workspaceRoot: root, maxFiles: 0 }), /positive safe integer/)
  assert.equal((await readFile(path.join(root, 'build/demo.exe'), 'utf8')), 'demo executable\n')
})

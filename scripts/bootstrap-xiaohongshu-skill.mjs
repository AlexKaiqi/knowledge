#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/skill-upstream.json'), 'utf8'))
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_SKILL_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-skill'))
const sourceRoot = path.join(runtimeRoot, 'src/xiaohongshu-skill')
const patchPath = path.join(repositoryRoot, manifest.patch.path)

async function command(file, args, options = {}) {
  try {
    return await run(file, args, { ...options, maxBuffer: 16 * 1024 * 1024 })
  } catch (error) {
    throw new Error(`${path.basename(file)} operation failed`, { cause: error })
  }
}

async function resolveUv() {
  try {
    await command('uv', ['--version'])
    return 'uv'
  } catch {}
  const bootstrapRoot = path.join(runtimeRoot, 'bootstrap-uv')
  const bootstrapUv = path.join(bootstrapRoot, 'bin/uv')
  try {
    await access(bootstrapUv)
  } catch {
    await command('python3', ['-m', 'venv', bootstrapRoot])
    await command(path.join(bootstrapRoot, 'bin/python'), [
      '-m', 'pip', 'install', '--disable-pip-version-check', '--only-binary=:all:', `uv==${manifest.bootstrapUvVersion}`,
    ])
  }
  const version = (await command(bootstrapUv, ['--version'])).stdout.trim()
  if (version.split(/\s+/).slice(0, 2).join(' ') !== `uv ${manifest.bootstrapUvVersion}`) {
    throw new Error(`unexpected bootstrap uv version: ${version}`)
  }
  return bootstrapUv
}

const patch = await readFile(patchPath)
const patchDigest = createHash('sha256').update(patch).digest('hex')
if (patchDigest !== manifest.patch.sha256) throw new Error('xiaohongshu-skill adapter patch digest mismatch')

await mkdir(sourceRoot, { recursive: true, mode: 0o700 })
try {
  await access(path.join(sourceRoot, '.git'))
} catch {
  await command('git', ['init', '-q'], { cwd: sourceRoot })
  await command('git', ['remote', 'add', 'origin', manifest.repository], { cwd: sourceRoot })
  await command('git', ['fetch', '--quiet', '--depth=1', 'origin', manifest.commit], { cwd: sourceRoot })
  await command('git', ['checkout', '--quiet', '--detach', manifest.commit], { cwd: sourceRoot })
}

const remote = (await command('git', ['remote', 'get-url', 'origin'], { cwd: sourceRoot })).stdout.trim()
if (remote !== manifest.repository) throw new Error(`unexpected xiaohongshu-skill upstream remote: ${remote}`)
const actualCommit = (await command('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot })).stdout.trim()
if (actualCommit !== manifest.commit) throw new Error(`xiaohongshu-skill upstream commit mismatch: ${actualCommit}`)

try {
  await command('git', ['apply', '--check', patchPath], { cwd: sourceRoot })
  await command('git', ['apply', patchPath], { cwd: sourceRoot })
} catch {
  try {
    await command('git', ['apply', '--reverse', '--check', patchPath], { cwd: sourceRoot })
  } catch {
    throw new Error('xiaohongshu-skill runtime is dirty or the reviewed adapter patch no longer applies')
  }
}

const runtimeStatus = (await command('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: sourceRoot })).stdout
if (runtimeStatus !== ' M scripts/__main__.py\n') {
  throw new Error('xiaohongshu-skill runtime contains changes outside the reviewed adapter patch')
}
const runtimeDiff = (await command('git', ['diff', '--binary', '--no-ext-diff', '--', 'scripts/__main__.py'], { cwd: sourceRoot })).stdout
const runtimeDiffDigest = createHash('sha256').update(runtimeDiff).digest('hex')
if (runtimeDiffDigest !== manifest.patch.runtimeDiffSha256) {
  throw new Error('xiaohongshu-skill runtime does not match the reviewed adapter patch')
}

const uv = await resolveUv()
await command(uv, ['python', 'install', manifest.pythonVersion], { cwd: sourceRoot })
await command(uv, ['sync', '--frozen', '--no-dev', '--python', manifest.pythonVersion], { cwd: sourceRoot })
const python = path.join(sourceRoot, '.venv/bin/python')
const pythonVersion = (await command(python, ['--version'], { cwd: sourceRoot })).stdout.trim()
if (!/^Python 3\.12\./.test(pythonVersion)) throw new Error(`unexpected xiaohongshu-skill Python version: ${pythonVersion}`)
const help = (await command(python, ['-m', 'scripts', 'publish', '--help'], { cwd: sourceRoot })).stdout
if (!/(?:^|\s)--visibility(?:\s|$)/m.test(help)) throw new Error('patched xiaohongshu-skill CLI does not expose --visibility')
const contracts = JSON.parse((await command(python, ['-m', 'scripts', '--quiet', 'contracts', '--command', 'publish'], { cwd: sourceRoot })).stdout)
if (!Array.isArray(contracts.contracts) || !contracts.contracts.some((entry) => entry.command === 'publish')) {
  throw new Error('xiaohongshu-skill publish JSON contract is unavailable')
}

let browserRuntime = 'not-installed'
if (process.env.KNOWLEDGE_XHS_SKILL_INSTALL_BROWSER !== 'false') {
  await command(uv, ['run', '--frozen', 'playwright', 'install', 'chromium'], { cwd: sourceRoot })
  browserRuntime = 'chromium-installed'
}

process.stdout.write(`${JSON.stringify({
  status: 'ready-local',
  routeId: 'creator-web-xiaohongshu-skill',
  upstream: manifest.repository,
  commit: actualCommit,
  patchSha256: patchDigest,
  runtimeDiffSha256: runtimeDiffDigest,
  uv: (await command(uv, ['--version'])).stdout.trim(),
  python: pythonVersion,
  license: manifest.license,
  jsonCliContract: 'publish',
  privateVisibilityCli: true,
  browserRuntime,
  note: 'Local build readiness is not a live capability verification.',
}, null, 2)}\n`)

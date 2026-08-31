#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/optifeed-radar-ai-readiness/upstream.json'), 'utf8'))
const runtimeRoot = path.resolve(process.env.OPTIFEED_RADAR_ROOT ?? path.join(repositoryRoot, '.runtime/optifeed-radar'))

async function command(file, args, options = {}) {
  try {
    return await run(file, args, { ...options, maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message
    throw new Error(`${file} ${args[0] ?? ''} failed: ${detail}`)
  }
}

await mkdir(runtimeRoot, { recursive: true, mode: 0o700 })
try {
  await access(path.join(runtimeRoot, '.git'))
} catch {
  await command('git', ['init', '-q'], { cwd: runtimeRoot })
  await command('git', ['remote', 'add', 'origin', manifest.repository], { cwd: runtimeRoot })
}

const remote = (await command('git', ['remote', 'get-url', 'origin'], { cwd: runtimeRoot })).stdout.trim()
if (remote !== manifest.repository) throw new Error(`unexpected upstream remote: ${remote}`)

const trackedChanges = (await command('git', ['status', '--short', '--untracked-files=no'], { cwd: runtimeRoot })).stdout.trim()
if (trackedChanges) throw new Error('reviewed Radar runtime has tracked changes; refusing to replace them')

await command('git', ['fetch', '--quiet', '--depth=1', 'origin', manifest.acceptedCommit], { cwd: runtimeRoot })
await command('git', ['checkout', '--quiet', '--detach', manifest.acceptedCommit], { cwd: runtimeRoot })
const actualCommit = (await command('git', ['rev-parse', 'HEAD'], { cwd: runtimeRoot })).stdout.trim()
if (actualCommit !== manifest.acceptedCommit) throw new Error(`upstream commit mismatch: ${actualCommit}`)

const packageJson = JSON.parse(await readFile(path.join(runtimeRoot, 'package.json'), 'utf8'))
if (packageJson.name !== manifest.packageName || packageJson.version !== manifest.packageVersion || packageJson.license !== manifest.license) {
  throw new Error('reviewed Radar package identity does not match the accepted manifest')
}

await command('npm', ['ci'], { cwd: runtimeRoot })
await command('npm', ['run', 'check'], { cwd: runtimeRoot })
await command('npm', ['run', 'format:check'], { cwd: runtimeRoot })
await command('npm', ['run', 'build'], { cwd: runtimeRoot })

process.stdout.write(`${JSON.stringify({
  status: 'ready-local',
  runtimeRoot,
  upstream: manifest.repository,
  commit: actualCommit,
  package: `${packageJson.name}@${packageJson.version}`,
  license: packageJson.license,
  checks: ['npm ci', 'npm run check', 'npm run format:check', 'npm run build'],
  note: 'The ignored local runtime is reproducible from the pinned manifest; live capability verification is separate.',
}, null, 2)}\n`)

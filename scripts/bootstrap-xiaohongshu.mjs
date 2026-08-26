#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'connectors/xiaohongshu-browser/upstream.json'), 'utf8'))
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const sourceRoot = path.join(runtimeRoot, 'src/xiaohongshu-mcp')
const binRoot = path.join(runtimeRoot, 'bin')

async function command(file, args, options = {}) {
  try {
    return await run(file, args, { ...options, maxBuffer: 16 * 1024 * 1024 })
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message
    throw new Error(`${file} ${args[0] ?? ''} failed: ${detail}`)
  }
}

await mkdir(sourceRoot, { recursive: true, mode: 0o700 })
try {
  await access(path.join(sourceRoot, '.git'))
} catch {
  await command('git', ['init', '-q'], { cwd: sourceRoot })
  await command('git', ['remote', 'add', 'origin', manifest.repository], { cwd: sourceRoot })
}

const remote = (await command('git', ['remote', 'get-url', 'origin'], { cwd: sourceRoot })).stdout.trim()
if (remote !== manifest.repository) throw new Error(`unexpected upstream remote: ${remote}`)
await command('git', ['fetch', '--quiet', '--depth=1', 'origin', manifest.commit], { cwd: sourceRoot })
await command('git', ['checkout', '--quiet', '--detach', manifest.commit], { cwd: sourceRoot })
const actualCommit = (await command('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot })).stdout.trim()
if (actualCommit !== manifest.commit) throw new Error(`upstream commit mismatch: ${actualCommit}`)

await command('go', ['test', './...'], { cwd: sourceRoot })
await mkdir(binRoot, { recursive: true, mode: 0o700 })
await command('go', ['build', '-trimpath', '-o', path.join(binRoot, 'xiaohongshu-mcp'), '.'], { cwd: sourceRoot })
await command('go', ['build', '-trimpath', '-o', path.join(binRoot, 'xiaohongshu-login'), './cmd/login'], { cwd: sourceRoot })

process.stdout.write(`${JSON.stringify({
  status: 'ready-local',
  upstream: manifest.repository,
  commit: actualCommit,
  license: manifest.license,
  binaries: ['xiaohongshu-mcp', 'xiaohongshu-login'],
  note: 'Local build readiness is not a live capability verification.',
}, null, 2)}\n`)

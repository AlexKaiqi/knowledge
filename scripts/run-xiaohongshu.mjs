#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { access, mkdir, open, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const accountStateRoot = path.resolve(process.env.KNOWLEDGE_XHS_ACCOUNT_STATE_ROOT ?? path.join(runtimeRoot, 'accounts/default'))
const operation = process.argv[2]
if (!['login', 'serve'].includes(operation)) throw new Error('usage: run-xiaohongshu.mjs <login|serve>')

const binary = path.join(runtimeRoot, 'bin', operation === 'login' ? 'xiaohongshu-login' : 'xiaohongshu-mcp')
await access(binary)
await mkdir(accountStateRoot, { recursive: true, mode: 0o700 })
const cookiesPath = path.join(accountStateRoot, 'cookies.json')
const environment = { ...process.env, COOKIES_PATH: cookiesPath }
const args = []
if (operation === 'serve') {
  const credentialRoot = path.join(runtimeRoot, 'credentials')
  const tokenPath = path.join(credentialRoot, 'sidecar-token')
  await mkdir(credentialRoot, { recursive: true, mode: 0o700 })
  let token = process.env.KNOWLEDGE_XHS_SIDECAR_TOKEN
  if (!token) {
    try {
      token = (await readFile(tokenPath, 'utf8')).trim()
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      token = randomBytes(32).toString('hex')
      const handle = await open(tokenPath, 'wx', 0o600)
      try { await handle.writeFile(`${token}\n`) } finally { await handle.close() }
    }
  }
  if (!token) throw new Error('sidecar token credential is empty')
  environment.AUTH_TOKEN = token
  args.push('-headless=false', '-port=:18060')
}

const child = spawn(binary, args, { cwd: accountStateRoot, env: environment, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

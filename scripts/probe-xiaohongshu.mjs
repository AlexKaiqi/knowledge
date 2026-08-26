#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { XiaohongshuBrowserConnector } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const stagingRoot = path.join(repositoryRoot, '.staging/xiaohongshu-live-probe')
const manifest = JSON.parse(await readFile(path.join(stagingRoot, 'revision.json'), 'utf8'))
const confirmation = JSON.parse(await readFile(path.join(stagingRoot, 'confirmation.json'), 'utf8'))
const token = (await readFile(path.join(runtimeRoot, 'credentials/sidecar-token'), 'utf8')).trim()
const connector = new XiaohongshuBrowserConnector({
  token,
  stateRoot: path.join(runtimeRoot, 'operations'),
  requestTimeoutMs: 120_000,
  verificationTimeoutMs: 180_000,
})
const startedAt = new Date().toISOString()
const result = await connector.publishPrivateNoteAndObserve({ revision: manifest.revision, confirmation })
const finishedAt = new Date().toISOString()
const evidence = {
  schemaVersion: 'knowledge.xiaohongshu-live-evidence/v1',
  startedAt,
  finishedAt,
  visibility: 'private',
  result,
}
const evidencePath = path.join(stagingRoot, 'evidence.json')
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${JSON.stringify({ ...evidence, evidencePath: path.relative(repositoryRoot, evidencePath) }, null, 2)}\n`)
if (result.status !== 'confirmed' || result.observation?.status !== 'available') process.exitCode = 2

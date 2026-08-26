#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { XiaohongshuBrowserConnector } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const token = (await readFile(path.join(runtimeRoot, 'credentials/sidecar-token'), 'utf8')).trim()
const connector = new XiaohongshuBrowserConnector({
  token,
  stateRoot: path.join(runtimeRoot, 'operations'),
  requestTimeoutMs: 120_000,
})
const session = await connector.inspectSession()
const baseline = session.ready ? await connector.baseline() : null
process.stdout.write(`${JSON.stringify({
  ready: session.ready,
  health: session.health,
  ownedNoteBaselineReadable: baseline !== null,
  ownedNoteCount: baseline?.feedIds.length ?? null,
  note: 'Read-only live check; no capability has been admitted.',
}, null, 2)}\n`)

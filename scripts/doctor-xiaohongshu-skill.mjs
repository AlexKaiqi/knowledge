#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { XiaohongshuBrowserConnector } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_SKILL_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-skill'))
const profile = process.env.KNOWLEDGE_XHS_SKILL_PROFILE
if (!profile) throw new Error('KNOWLEDGE_XHS_SKILL_PROFILE must bind an explicitly authorized owned-test identity to an opaque local profile')

const connector = new XiaohongshuBrowserConnector({
  routeId: 'creator-web-xiaohongshu-skill',
  skillRuntimeRoot: runtimeRoot,
  profile,
  stateRoot: path.join(runtimeRoot, 'operations', profile),
  requestTimeoutMs: 120_000,
})
const session = await connector.inspectSession()
const baseline = session.readReady ? await connector.baseline() : null
process.stdout.write(`${JSON.stringify({
  routeId: 'creator-web-xiaohongshu-skill',
  readReady: session.readReady,
  writeReady: session.writeReady,
  health: session.health,
  ownedNoteBaselineReadable: baseline !== null,
  ownedNoteCount: baseline?.feedIds.length ?? null,
  note: 'Read-only live check; route remains non-automatic until the write probe passes.',
}, null, 2)}\n`)

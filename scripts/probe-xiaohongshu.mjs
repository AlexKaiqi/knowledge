#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { XiaohongshuBrowserConnector } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-browser'))
const skillRuntimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_SKILL_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-skill'))
const routeArgument = process.argv.find((argument) => argument.startsWith('--route='))
const routeId = routeArgument?.slice('--route='.length) || 'creator-web-xiaohongshu-mcp'
const stagingRoot = path.join(repositoryRoot, '.staging/xiaohongshu-live-probe')
const manifest = JSON.parse(await readFile(path.join(stagingRoot, 'revision.json'), 'utf8'))
const confirmation = JSON.parse(await readFile(path.join(stagingRoot, 'confirmation.json'), 'utf8'))
let connector
if (routeId === 'creator-web-xiaohongshu-skill') {
  const profile = process.env.KNOWLEDGE_XHS_SKILL_PROFILE
  if (!profile) throw new Error('KNOWLEDGE_XHS_SKILL_PROFILE must bind the approved probe identity to an opaque local profile')
  connector = new XiaohongshuBrowserConnector({
    routeId,
    skillRuntimeRoot,
    profile,
    stateRoot: path.join(skillRuntimeRoot, 'operations', profile),
    requestTimeoutMs: 120_000,
    verificationTimeoutMs: 180_000,
  })
} else {
  const token = (await readFile(path.join(runtimeRoot, 'credentials/sidecar-token'), 'utf8')).trim()
  connector = new XiaohongshuBrowserConnector({
    routeId,
    token,
    stateRoot: path.join(runtimeRoot, 'operations'),
    requestTimeoutMs: 120_000,
    verificationTimeoutMs: 180_000,
  })
}
const startedAt = new Date().toISOString()
const result = await connector.publishPrivateNoteAndObserve({ revision: manifest.revision, confirmation })
const finishedAt = new Date().toISOString()
const evidence = {
  schemaVersion: 'knowledge.xiaohongshu-live-evidence/v1',
  routeId,
  startedAt,
  finishedAt,
  visibility: 'private',
  result,
}
const evidencePath = path.join(stagingRoot, 'evidence.json')
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${JSON.stringify({ ...evidence, evidencePath: path.relative(repositoryRoot, evidencePath) }, null, 2)}\n`)
if (result.status !== 'confirmed' || result.observation?.status !== 'available') process.exitCode = 2

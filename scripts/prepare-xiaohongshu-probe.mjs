#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { computeRevisionDigest } from '../connectors/xiaohongshu-browser/src/index.mjs'

const run = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const markerSuffix = randomBytes(4).toString('hex')
const marker = `marker:xhs-private-probe-${markerSuffix}`
const revisionId = `xhs-private-probe-20260826-${markerSuffix}`
const artifactRoot = path.join(repositoryRoot, '.runtime/xiaohongshu-browser/probes', revisionId)
const stagingRoot = path.join(repositoryRoot, '.staging/xiaohongshu-live-probe')
await mkdir(artifactRoot, { recursive: true, mode: 0o700 })
await mkdir(stagingRoot, { recursive: true, mode: 0o700 })

const svgPath = path.join(artifactRoot, 'probe.svg')
const pngPath = path.join(artifactRoot, 'probe.png')
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
  <rect width="1080" height="1440" fill="#f7f3ea"/>
  <rect x="72" y="72" width="936" height="1296" rx="48" fill="#ffffff" stroke="#e34b4b" stroke-width="8"/>
  <circle cx="540" cy="380" r="150" fill="#e34b4b"/>
  <path d="M470 380l45 45 100-115" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="540" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="70" font-weight="700" fill="#202124">CONNECTOR PROBE</text>
  <text x="540" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#e34b4b">PRIVATE / ONLY ME</text>
  <text x="540" y="890" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" fill="#5f6368">No promotion without verification</text>
  <text x="540" y="1040" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#5f6368">2026-08-26</text>
  <text x="540" y="1120" text-anchor="middle" font-family="monospace" font-size="28" fill="#5f6368">${marker}</text>
</svg>
`
await writeFile(svgPath, svg, { mode: 0o600 })
await run('/usr/bin/sips', ['-s', 'format', 'png', svgPath, '--out', pngPath])
const png = await import('node:fs/promises').then(({ readFile }) => readFile(pngPath))
const mediaSha256 = createHash('sha256').update(png).digest('hex')
const revision = {
  id: revisionId,
  title: `私密闭环探针 ${markerSuffix.slice(0, 4)}`,
  body: `这是 knowledge Connector 的私密闭环测试笔记，仅用于验证发布、平台侧反查与反馈回流。\n\n${marker}`,
  verificationMarker: marker,
  topics: [],
  media: [{ kind: 'image', path: pngPath, sha256: mediaSha256 }],
}
const revisionDigest = computeRevisionDigest(revision)
const manifest = {
  schemaVersion: 'knowledge.xiaohongshu-probe-revision/v1',
  capabilityId: 'xiaohongshu.note.publish-private-and-observe',
  visibility: 'private',
  preparedAt: new Date().toISOString(),
  revision,
  revisionDigest,
}
const manifestPath = path.join(stagingRoot, 'revision.json')
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${JSON.stringify({
  revisionId,
  title: revision.title,
  body: revision.body,
  visibility: 'private',
  mediaPath: pngPath,
  mediaSha256,
  revisionDigest,
  manifestPath: path.relative(repositoryRoot, manifestPath),
  status: 'frozen-awaiting-explicit-confirmation',
}, null, 2)}\n`)

#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const approvalFlag = '--i-own-account-and-approve-private-publication'
if (!process.argv.includes(approvalFlag)) throw new Error(`explicit approval flag required: ${approvalFlag}`)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stagingRoot = path.join(repositoryRoot, '.staging/xiaohongshu-live-probe')
const manifest = JSON.parse(await readFile(path.join(stagingRoot, 'revision.json'), 'utf8'))
const issuedAt = new Date()
const confirmation = {
  schemaVersion: 'knowledge.one-time-confirmation/v1',
  capabilityId: manifest.capabilityId,
  revisionId: manifest.revision.id,
  revisionDigest: manifest.revisionDigest,
  visibility: 'private',
  ownershipAttestation: 'user-confirmed-owned-account',
  issuedAt: issuedAt.toISOString(),
  expiresAt: new Date(issuedAt.getTime() + 15 * 60_000).toISOString(),
}
await writeFile(path.join(stagingRoot, 'confirmation.json'), `${JSON.stringify(confirmation, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${JSON.stringify({
  revisionId: confirmation.revisionId,
  revisionDigest: confirmation.revisionDigest,
  visibility: confirmation.visibility,
  expiresAt: confirmation.expiresAt,
  status: 'confirmed-once',
}, null, 2)}\n`)

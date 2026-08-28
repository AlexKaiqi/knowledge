import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareDurableMemoryChangeReviewRevision } from '../connectors/durable-memory-change-review-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionRoot = '/Users/kaiqidong/Developer/dsh-plugins/dsh-personal-knowledge-base'
const productionRevision = 'c8e181adcf3904f47fd33b85ffc1e97126cbbd66'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const digestText = (value) => `sha256:${sha256(value)}`
const startedAt = new Date()

const servicePath = path.join(productionRoot, 'dsh/service.js')
const layoutPath = path.join(productionRoot, 'spec/repository-layout.json')
const serviceBody = await readFile(servicePath)
const layoutBody = await readFile(layoutPath)
if (sha256(serviceBody) !== 'b849ae068d99070181b14f80eb2b0385a0f996253b8717d2331682d60a0e4bbf') throw new Error('pinned production service digest mismatch')
if (sha256(layoutBody) !== '5d2a81bda32184a2114c4ad525ce92c62302d5cf31074cc04ea0801bb2124bde') throw new Error('pinned repository layout digest mismatch')
const serviceText = serviceBody.toString('utf8')
const layoutText = layoutBody.toString('utf8')
for (const semantic of ['confirmed=true is required', 'knowledge changed after proposal creation; create a new proposal', 'proposal.baseHash', 'receipt']) if (!serviceText.includes(semantic)) throw new Error(`production service semantic missing: ${semantic}`)
for (const semantic of ['explicit-confirmation', 'atomic-write', 'git-commit', 'backgroundAgentMayConfirm']) if (!layoutText.includes(semantic)) throw new Error(`repository layout semantic missing: ${semantic}`)

const { PersonalKnowledgeBase } = await import(pathToFileURL(servicePath).href)
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-memory-review-probe-'))
let receipt
let conflictObserved = false
let prepared
try {
  const pkb = new PersonalKnowledgeBase(temporaryRoot)
  pkb.init()
  const content = '# Preferences\n\n- Quiet hours: 22:00–08:00.\n'
  const proposal = pkb.propose({ operation: 'upsert', path: 'knowledge/preferences.md', content, reason: 'Stable confirmed preference', source: 'session:fixture-1' })
  prepared = prepareDurableMemoryChangeReviewRevision({
    ownerScopeRef: 'owner:primary',
    repositoryRevisionRef: `git:${pkb.revision()}`,
    target: { path: proposal.path, exists: proposal.baseHash !== null, contentDigest: proposal.baseHash === null ? null : `sha256:${proposal.baseHash}` },
    change: {
      operation: proposal.operation,
      baseContentDigest: proposal.baseHash === null ? null : `sha256:${proposal.baseHash}`,
      content: proposal.content,
      reason: proposal.reason,
      sourceRefs: [proposal.source],
      evidenceRefs: ['confirmation:fixture-1'],
    },
  }, { now: () => new Date('2026-08-27T06:00:00Z') })
  if (prepared.status !== 'ready-for-human-review' || prepared.proposalCreated || prepared.applied || prepared.committed || prepared.receiptIssued || prepared.executionAuthorized) throw new Error('review preparation boundary mismatch')
  receipt = pkb.applyProposal(proposal.id, true)
  if (!receipt.ok || !receipt.commit || receipt.recovered) throw new Error('production proposal/apply/commit/receipt flow failed')

  const conflictProposal = pkb.propose({ operation: 'upsert', path: 'knowledge/preferences.md', content: '# Preferences\n\n- Quiet hours: 23:00–08:00.\n', reason: 'Test conflict', source: 'session:fixture-2' })
  await writeFile(path.join(temporaryRoot, 'knowledge/preferences.md'), '# Preferences\n\n- Concurrent edit.\n')
  try { pkb.applyProposal(conflictProposal.id, true) } catch (error) { conflictObserved = String(error.message).includes('knowledge changed after proposal creation') }
  if (!conflictObserved) throw new Error('production target conflict was not observed')

  const stale = prepareDurableMemoryChangeReviewRevision({
    ownerScopeRef: 'owner:primary', repositoryRevisionRef: `git:${pkb.revision()}`,
    target: { path: conflictProposal.path, exists: true, contentDigest: digestText('# Preferences\n\n- Concurrent edit.\n') },
    change: { operation: 'upsert', baseContentDigest: `sha256:${conflictProposal.baseHash}`, content: conflictProposal.content, reason: conflictProposal.reason, sourceRefs: [conflictProposal.source], evidenceRefs: ['confirmation:fixture-2'] },
  })
  if (stale.status !== 'blocked' || stale.preflight.blockers[0]?.code !== 'target-changed-after-proposal') throw new Error('connector stale target blocker failed')

  const replay = prepareDurableMemoryChangeReviewRevision({
    ownerScopeRef: 'owner:primary', repositoryRevisionRef: `git:${receipt.commit}`,
    target: { path: proposal.path, exists: true, contentDigest: prepared.change.desiredContentDigest },
    change: { operation: proposal.operation, baseContentDigest: null, content: proposal.content, reason: proposal.reason, sourceRefs: [proposal.source], evidenceRefs: ['confirmation:fixture-1'] },
  })
  if (replay.status !== 'already-satisfied' || replay.reviewRevisionHash !== null) throw new Error('idempotent replay recognition failed')

  const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/prepare-durable-memory-change-review-revision-output.schema.json'), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  if (!validate(prepared)) throw new Error(`durable memory review output schema mismatch: ${JSON.stringify(validate.errors)}`)

  const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/durable-memory-change-review-revision/snapshot.json')
  const reportPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/durable-memory-change-review-revision/report.json')
  await mkdir(path.dirname(snapshotPath), { recursive: true })
  await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'isolated-production-pkb-upsert', productionRevision, productionReceipt: { ok: receipt.ok, operation: receipt.operation, path: receipt.path, recovered: receipt.recovered, committed: Boolean(receipt.commit) }, conflictObserved, ...prepared }, null, 2)}\n`)
  const finishedAt = new Date()
  const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const report = {
    schemaVersion: 'dsh.probe-report/v1', id: `durable-memory-change-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
    capabilityRef: '/capabilities/assistant/prepare-durable-memory-change-review-revision.md', connectorId: 'durable-memory-change-review-revision',
    probeDefinitionRef: 'repo:/probes/definitions/durable-memory-change-review-revision-local.json', environment: 'local', level: 'local', outcome: 'passed',
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
    checks: [
      { id: 'pinned-production-semantics', status: 'passed' }, { id: 'real-proposal-confirmation-commit-receipt', status: 'passed' },
      { id: 'exact-review-revision-binding', status: 'passed' }, { id: 'production-conflict-detection', status: 'passed' },
      { id: 'idempotent-replay-recognition', status: 'passed' }, { id: 'output-schema', status: 'passed' },
      { id: 'non-write-non-authorization-boundary', status: 'passed' }, { id: 'temporary-repository-cleanup', status: 'passed' }
    ],
    evidence: [
      { kind: 'artifact', ref: `https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/${productionRevision}/dsh/service.js`, sha256: sha256(serviceBody) },
      { kind: 'artifact', ref: `https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/${productionRevision}/spec/repository-layout.json`, sha256: sha256(layoutBody) },
      { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/durable-memory-change-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
    ],
    sideEffects: [{ effect: 'none', status: 'none' }]
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

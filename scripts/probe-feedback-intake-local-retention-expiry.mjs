import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { collectFeedbackIntakeLocalRetentionExpiryMaintenance } from '../collectors/feedback-intake-local-retention-expiry-maintainer/src/index.mjs'
import { FeedbackIntakeLocalRetentionExpiry } from '../connectors/feedback-intake-local-retention-expiry/src/index.mjs'
import { FeedbackIntakeLocalStore } from '../connectors/feedback-intake-local-store/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-retention-expiry-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const sourceEvidence = []

for (const source of sourceCatalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-retention-expiry-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8')
  for (const assertion of source.observation.assertions) if (!text.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
  sourceEvidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const revisionPath = path.join(repositoryRoot, 'knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json')
const storageSnapshotPath = path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-storage/snapshot.json')
const storageReportPath = path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-storage/report.json')
const { fixture: _fixture, ...revision } = JSON.parse(await readFile(revisionPath, 'utf8'))
const storeRef = 'feedback-store:owner-primary'
const revisionRef = 'repo:/knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json'
const expiredNow = () => new Date('2027-02-23T08:00:01Z')
const roots = []

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-expiry-probe-'))
  roots.push(root)
  return root
}

async function persistFixture(root) {
  const store = new FeedbackIntakeLocalStore({
    root,
    storeRef,
    now: () => new Date('2026-08-27T09:40:00Z'),
    resolveIntakeRevision: async (ref) => {
      if (ref !== revisionRef) throw new Error('probe storage resolver received an unexpected ref')
      return structuredClone(revision)
    },
    verifyReviewGrant: async (request) => ({ authorized: true, capabilityId: request.capabilityId, effect: request.effect, storeRef: request.storeRef, intakeRevisionHash: request.intakeRevisionHash, grantReceiptRef: 'probe-review-receipt:feedback-intake-01', authorizedAt: '2026-08-27T09:39:00Z', expiresAt: '2026-08-27T10:30:00Z' }),
  })
  const storageReceipt = await store.persist({ storeRef, intakeRevisionRef: revisionRef, intakeRevisionHash: revision.intakeRevisionHash, reviewGrantRef: 'review-grant:probe-feedback-intake-01', idempotencyKey: 'probe-feedback-intake-01' })
  return { store, storageReceipt }
}

function expiryInput(storageReceipt) {
  return { storeRef, storageReceiptRef: storageReceipt.receiptRef, recordDigest: storageReceipt.recordDigest, retentionPolicyRef: revision.retention.policyRef, deleteAfter: storageReceipt.deleteAfter, retentionGrantRef: 'retention-grant:probe-feedback-intake-01', idempotencyKey: 'probe-feedback-retention-expiry-01' }
}

function expiryHarness(root, { now = expiredNow, grantOverride = {}, onPhase, onGrant } = {}) {
  return new FeedbackIntakeLocalRetentionExpiry({
    root,
    storeRef,
    now,
    onPhase,
    verifyRetentionGrant: async (request) => {
      onGrant?.(request)
      return { authorized: true, capabilityId: request.capabilityId, effect: request.effect, storeRef: request.storeRef, storageReceiptRef: request.storageReceiptRef, recordDigest: request.recordDigest, retentionPolicyRef: request.retentionPolicyRef, deleteAfter: request.deleteAfter, disposition: 'delete', holdStatus: 'clear', grantReceiptRef: 'probe-retention-receipt:feedback-intake-01', authorizedAt: '2027-02-23T08:00:00Z', expiresAt: '2027-02-23T09:00:00Z', ...grantOverride }
    },
  })
}

const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/expire-consented-intake-record-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/expire-consented-intake-record-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)

let firstReceipt
let temporaryJournalDigest
try {
  const mainRoot = await temporaryRoot()
  const mainStored = await persistFixture(mainRoot)
  const input = expiryInput(mainStored.storageReceipt)
  if (!validateInput(input)) throw new Error(`feedback retention expiry input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
  let earlyGrantCalls = 0
  const early = expiryHarness(mainRoot, { now: () => new Date('2027-02-23T07:59:59Z'), onGrant: () => { earlyGrantCalls += 1 } })
  await early.expire(input).then(() => { throw new Error('early retention deletion was accepted') }, (error) => { if (!/not yet due/.test(error.message)) throw error })
  if (earlyGrantCalls !== 0 || (await mainStored.store.listRecordFilesForVerification()).length !== 1) throw new Error('early retention deletion consulted authority or changed storage')
  try { await readdir(path.join(mainRoot, 'retention-expirations')); throw new Error('early deletion created control state') } catch (error) { if (error.code !== 'ENOENT') throw error }

  const mainExpiry = expiryHarness(mainRoot)
  const candidates = await mainExpiry.listRetentionCandidatesForMaintenance({ now: expiredNow() })
  const maintenance = await collectFeedbackIntakeLocalRetentionExpiryMaintenance({
    now: expiredNow,
    sourceCheck: async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) }),
    report: { expiresAt: '2027-03-23T08:00:00Z' },
    retentionCandidates: candidates,
  })
  if (maintenance.proposals.length !== 1 || maintenance.proposals[0].action !== 'review-due-retention-deletion' || (await mainStored.store.listRecordFilesForVerification()).length !== 1) throw new Error('Collector did not remain proposal-only for a due record')

  const concurrent = await Promise.all([mainExpiry.expire(input), mainExpiry.expire(input)])
  if (concurrent.map((item) => item.replayed).sort().join(',') !== 'false,true') throw new Error('concurrent retention deletion did not produce one effect and one replay')
  firstReceipt = concurrent.find((item) => !item.replayed)
  if (!validateOutput(firstReceipt)) throw new Error(`feedback retention expiry output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
  if (firstReceipt.recordPresent || !firstReceipt.retentionDeletionApplied || firstReceipt.withdrawalApplied || firstReceipt.mediaSanitized || firstReceipt.backupsPurged || firstReceipt.downstreamCopiesDeleted || firstReceipt.replySent || firstReceipt.platformWritten || firstReceipt.knowledgeWritten || firstReceipt.executionAuthorized) throw new Error('feedback retention deletion receipt boundary mismatch')
  if ((await mainExpiry.listRecordFilesForVerification()).length !== 0) throw new Error('retention deletion left the feedback record present')
  const expirationFiles = await mainExpiry.listExpirationFilesForVerification()
  if (expirationFiles.length !== 1) throw new Error('retention deletion did not leave exactly one journal')
  const journalBytes = await readFile(path.join(mainRoot, 'retention-expirations', expirationFiles[0]))
  const journalText = journalBytes.toString('utf8')
  if (JSON.parse(journalText).state !== 'committed' || journalText.includes(revision.submission.answers[0].statement)) throw new Error('retention deletion journal state or data minimization mismatch')
  temporaryJournalDigest = sha256(journalBytes)
  const replay = await mainExpiry.expire(input)
  if (!replay.replayed || replay.retentionDeletionReceiptRef !== firstReceipt.retentionDeletionReceiptRef || !validateOutput(replay)) throw new Error('retention deletion replay mismatch')

  const holdRoot = await temporaryRoot()
  const holdStored = await persistFixture(holdRoot)
  const holdInput = expiryInput(holdStored.storageReceipt)
  await expiryHarness(holdRoot, { grantOverride: { holdStatus: 'active' } }).expire(holdInput).then(() => { throw new Error('active hold was ignored') }, (error) => { if (!/reports a hold/.test(error.message)) throw error })
  if ((await holdStored.store.listRecordFilesForVerification()).length !== 1) throw new Error('hold rejection changed the record')

  const recoveryRoot = await temporaryRoot()
  const recoveryStored = await persistFixture(recoveryRoot)
  const recoveryInput = expiryInput(recoveryStored.storageReceipt)
  let interrupted = false
  const interruptedExpiry = expiryHarness(recoveryRoot, { onPhase: async ({ phase }) => { if (!interrupted && phase === 'record-unlinked') { interrupted = true; throw new Error('probe interruption after record unlink') } } })
  await interruptedExpiry.expire(recoveryInput).then(() => { throw new Error('interruption hook did not interrupt retention deletion') }, (error) => { if (!/probe interruption/.test(error.message)) throw error })
  const recovered = await expiryHarness(recoveryRoot).expire(recoveryInput)
  if (!recovered.replayed || (await interruptedExpiry.listRecordFilesForVerification()).length !== 0) throw new Error('retention deletion did not recover after unlink')

  const tamperedRoot = await temporaryRoot()
  const tamperedStored = await persistFixture(tamperedRoot)
  const tamperedInput = expiryInput(tamperedStored.storageReceipt)
  const recordPath = path.join(tamperedRoot, 'records', (await tamperedStored.store.listRecordFilesForVerification())[0])
  const envelope = JSON.parse(await readFile(recordPath, 'utf8'))
  envelope.record.intakeRevision.retention.policyRef = 'retention:tampered'
  await writeFile(recordPath, `${JSON.stringify(envelope, null, 2)}\n`)
  await expiryHarness(tamperedRoot).expire(tamperedInput).then(() => { throw new Error('tampered retention record was deleted') }, (error) => { if (!/record integrity mismatch/.test(error.message)) throw error })
  await expiryHarness(tamperedRoot).expire({ ...tamperedInput, path: '/tmp/public-path-injection' }).then(() => { throw new Error('public expiry path was accepted') }, (error) => { if (!/unsupported fields/.test(error.message)) throw error })
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
}

for (const root of roots) {
  try { await readdir(root); throw new Error(`isolated retention expiry probe root was not removed: ${root}`) } catch (error) { if (error.code !== 'ENOENT') throw error }
}

const verificationDirectory = path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-retention-expiry')
const snapshotPath = path.join(verificationDirectory, 'snapshot.json')
const reportPath = path.join(verificationDirectory, 'report.json')
await mkdir(verificationDirectory, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'isolated-feedback-intake-retention-expiry', ...firstReceipt }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `feedback-intake-local-retention-expiry-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/expire-consented-intake-record.md',
  connectorId: 'feedback-intake-local-retention-expiry',
  probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-retention-expiry-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-retention-deletion-and-sanitization-sources', status: 'passed' },
    { id: 'verified-storage-receipt-and-retention-chain', status: 'passed' },
    { id: 'early-deletion-no-effect', status: 'passed' },
    { id: 'collector-due-proposal-only', status: 'passed' },
    { id: 'exact-clear-hold-retention-grant', status: 'passed' },
    { id: 'real-logical-deletion-with-simulated-expiry-clock', status: 'passed', detail: 'The clock was fixed one second after the immutable deadline; filesystem creation, unlink, sync, recovery and cleanup were real.' },
    { id: 'idempotent-concurrent-and-interruption-recovery', status: 'passed' },
    { id: 'hold-tamper-and-path-rejection', status: 'passed' },
    { id: 'public-input-and-receipt-schema', status: 'passed' },
    { id: 'isolated-store-cleanup', status: 'passed' },
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/intake-local-storage/snapshot.json', sha256: sha256(await readFile(storageSnapshotPath)) },
    { kind: 'artifact', ref: 'repo:/knowledge/verifications/feedback/intake-local-storage/report.json', sha256: sha256(await readFile(storageReportPath)) },
    { kind: 'test-output', ref: 'probe:isolated-feedback-retention-expiry-journal', sha256: temporaryJournalDigest },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/intake-local-retention-expiry/snapshot.json', sha256: sha256(await readFile(snapshotPath)) },
  ],
  sideEffects: [{ effect: 'local-write', status: 'cleaned' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

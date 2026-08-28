import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { FeedbackIntakeLocalStore } from '../connectors/feedback-intake-local-store/src/index.mjs'
import { FeedbackIntakeLocalWithdrawal } from '../connectors/feedback-intake-local-withdrawal/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-withdrawal-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const sourceEvidence = []

for (const source of sourceCatalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-local-withdrawal-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
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
const now = () => new Date('2026-08-27T10:00:00Z')
const roots = []

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-withdrawal-probe-'))
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
    verifyReviewGrant: async (request) => ({
      authorized: true,
      capabilityId: request.capabilityId,
      effect: request.effect,
      storeRef: request.storeRef,
      intakeRevisionHash: request.intakeRevisionHash,
      grantReceiptRef: 'probe-review-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:39:00Z',
      expiresAt: '2026-08-27T10:30:00Z',
    }),
  })
  const storageReceipt = await store.persist({
    storeRef,
    intakeRevisionRef: revisionRef,
    intakeRevisionHash: revision.intakeRevisionHash,
    reviewGrantRef: 'review-grant:probe-feedback-intake-01',
    idempotencyKey: 'probe-feedback-intake-01',
  })
  return { store, storageReceipt }
}

function withdrawalInput(storageReceipt) {
  return {
    storeRef,
    storageReceiptRef: storageReceipt.receiptRef,
    recordDigest: storageReceipt.recordDigest,
    withdrawalRequestRef: 'withdrawal-request:probe-feedback-intake-01',
    withdrawalMechanismRef: storageReceipt.withdrawalMechanismRef,
    withdrawalGrantRef: 'withdrawal-grant:probe-feedback-intake-01',
    idempotencyKey: 'probe-feedback-withdrawal-01',
  }
}

function withdrawalHarness(root, { grantOverride = {}, onPhase } = {}) {
  return new FeedbackIntakeLocalWithdrawal({
    root,
    storeRef,
    now,
    onPhase,
    verifyWithdrawalGrant: async (request) => ({
      authorized: true,
      capabilityId: request.capabilityId,
      effect: request.effect,
      storeRef: request.storeRef,
      storageReceiptRef: request.storageReceiptRef,
      recordDigest: request.recordDigest,
      withdrawalRequestRef: request.withdrawalRequestRef,
      withdrawalMechanismRef: request.withdrawalMechanismRef,
      grantReceiptRef: 'probe-withdrawal-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:59:00Z',
      expiresAt: '2026-08-27T10:30:00Z',
      ...grantOverride,
    }),
  })
}

const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/withdraw-consented-intake-record-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/withdraw-consented-intake-record-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)

let firstReceipt
let temporaryJournalDigest
try {
  const mainRoot = await temporaryRoot()
  const mainStored = await persistFixture(mainRoot)
  const input = withdrawalInput(mainStored.storageReceipt)
  if (!validateInput(input)) throw new Error(`feedback withdrawal input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
  const mainWithdrawal = withdrawalHarness(mainRoot)
  const concurrent = await Promise.all([mainWithdrawal.withdraw(input), mainWithdrawal.withdraw(input)])
  if (concurrent.map((item) => item.replayed).sort().join(',') !== 'false,true') throw new Error('concurrent withdrawal did not produce one effect and one replay')
  firstReceipt = concurrent.find((item) => !item.replayed)
  if (!validateOutput(firstReceipt)) throw new Error(`feedback withdrawal output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
  if (firstReceipt.recordPresent || !firstReceipt.logicalDeletionApplied || !firstReceipt.withdrawalApplied || firstReceipt.mediaSanitized || firstReceipt.backupsPurged || firstReceipt.downstreamCopiesDeleted || firstReceipt.replySent || firstReceipt.platformWritten || firstReceipt.knowledgeWritten || firstReceipt.executionAuthorized) throw new Error('feedback withdrawal receipt boundary mismatch')
  if ((await mainWithdrawal.listRecordFilesForVerification()).length !== 0) throw new Error('withdrawal left the feedback intake record present')
  const withdrawalFiles = await mainWithdrawal.listWithdrawalFilesForVerification()
  if (withdrawalFiles.length !== 1) throw new Error('withdrawal did not leave exactly one committed journal')
  const journalBytes = await readFile(path.join(mainRoot, 'withdrawals', withdrawalFiles[0]))
  const journalText = journalBytes.toString('utf8')
  const journal = JSON.parse(journalText)
  if (journal.state !== 'committed' || journal.receipt.withdrawalReceiptRef !== firstReceipt.withdrawalReceiptRef) throw new Error('withdrawal journal is not committed to the public receipt')
  if (journalText.includes(revision.submission.answers[0].statement)) throw new Error('withdrawal journal retained feedback content')
  temporaryJournalDigest = sha256(journalBytes)
  const replay = await mainWithdrawal.withdraw(input)
  if (!replay.replayed || replay.withdrawalReceiptRef !== firstReceipt.withdrawalReceiptRef || !validateOutput(replay)) throw new Error('withdrawal replay mismatch')

  const recoveryRoot = await temporaryRoot()
  const recoveryStored = await persistFixture(recoveryRoot)
  const recoveryInput = withdrawalInput(recoveryStored.storageReceipt)
  let interrupted = false
  const interruptedWithdrawal = withdrawalHarness(recoveryRoot, { onPhase: async ({ phase }) => {
    if (!interrupted && phase === 'record-unlinked') {
      interrupted = true
      throw new Error('probe interruption after record unlink')
    }
  } })
  await interruptedWithdrawal.withdraw(recoveryInput).then(() => { throw new Error('interruption hook did not interrupt withdrawal') }, (error) => { if (!/probe interruption/.test(error.message)) throw error })
  const recovered = await withdrawalHarness(recoveryRoot).withdraw(recoveryInput)
  if (!recovered.replayed || (await interruptedWithdrawal.listRecordFilesForVerification()).length !== 0) throw new Error('pending withdrawal transaction did not recover after unlink')

  const rejectedRoot = await temporaryRoot()
  const rejectedStored = await persistFixture(rejectedRoot)
  const rejectedInput = withdrawalInput(rejectedStored.storageReceipt)
  await withdrawalHarness(rejectedRoot, { grantOverride: { authorized: false } }).withdraw(rejectedInput).then(() => { throw new Error('untrusted withdrawal grant was accepted') }, (error) => { if (!/grant was rejected/.test(error.message)) throw error })
  if ((await rejectedStored.store.listRecordFilesForVerification()).length !== 1) throw new Error('rejected withdrawal changed the stored record')
  try {
    await readdir(path.join(rejectedRoot, 'withdrawals'))
    throw new Error('rejected withdrawal created control state')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await withdrawalHarness(rejectedRoot).withdraw({ ...rejectedInput, path: '/tmp/public-path-injection' }).then(() => { throw new Error('public withdrawal path was accepted') }, (error) => { if (!/unsupported fields/.test(error.message)) throw error })

  const tamperedRoot = await temporaryRoot()
  const tamperedStored = await persistFixture(tamperedRoot)
  const tamperedInput = withdrawalInput(tamperedStored.storageReceipt)
  const recordPath = path.join(tamperedRoot, 'records', (await tamperedStored.store.listRecordFilesForVerification())[0])
  const envelope = JSON.parse(await readFile(recordPath, 'utf8'))
  envelope.record.intakeRevision.submission.answers[0].statement += ' tampered after storage'
  await writeFile(recordPath, `${JSON.stringify(envelope, null, 2)}\n`)
  await withdrawalHarness(tamperedRoot).withdraw(tamperedInput).then(() => { throw new Error('tampered stored feedback record was withdrawn') }, (error) => { if (!/record integrity mismatch/.test(error.message)) throw error })
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
}

for (const root of roots) {
  try {
    await readdir(root)
    throw new Error(`isolated feedback withdrawal probe root was not removed: ${root}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const verificationDirectory = path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-withdrawal')
const snapshotPath = path.join(verificationDirectory, 'snapshot.json')
const reportPath = path.join(verificationDirectory, 'report.json')
await mkdir(verificationDirectory, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'isolated-feedback-intake-local-withdrawal', ...firstReceipt }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `feedback-intake-local-withdrawal-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/withdraw-consented-intake-record.md',
  connectorId: 'feedback-intake-local-withdrawal',
  probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-withdrawal-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-withdrawal-deletion-and-sanitization-sources', status: 'passed' },
    { id: 'verified-storage-receipt-chain', status: 'passed' },
    { id: 'exact-trusted-withdrawal-grant', status: 'passed' },
    { id: 'logical-record-removal-and-committed-receipt', status: 'passed' },
    { id: 'idempotent-and-concurrent-replay', status: 'passed' },
    { id: 'post-unlink-interruption-recovery', status: 'passed' },
    { id: 'untrusted-path-and-tamper-rejection', status: 'passed' },
    { id: 'public-input-and-receipt-schema', status: 'passed' },
    { id: 'isolated-store-cleanup', status: 'passed' },
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/intake-local-storage/snapshot.json', sha256: sha256(await readFile(storageSnapshotPath)) },
    { kind: 'artifact', ref: 'repo:/knowledge/verifications/feedback/intake-local-storage/report.json', sha256: sha256(await readFile(storageReportPath)) },
    { kind: 'test-output', ref: 'probe:isolated-feedback-withdrawal-journal', sha256: temporaryJournalDigest },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/intake-local-withdrawal/snapshot.json', sha256: sha256(await readFile(snapshotPath)) },
  ],
  sideEffects: [{ effect: 'local-write', status: 'cleaned' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

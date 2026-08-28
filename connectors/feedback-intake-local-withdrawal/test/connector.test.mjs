import assert from 'node:assert/strict'
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareConsentedFeedbackIntakeRevision } from '../../consented-feedback-intake-revision/src/index.mjs'
import { FeedbackIntakeLocalStore } from '../../feedback-intake-local-store/src/index.mjs'
import { FeedbackIntakeLocalWithdrawal } from '../src/index.mjs'

const preparationInput = JSON.parse(await readFile(new URL('../../../probes/fixtures/feedback/consented-intake.json', import.meta.url), 'utf8'))
const revision = prepareConsentedFeedbackIntakeRevision(preparationInput)
const storeRef = 'feedback-store:owner-primary'
const revisionRef = 'intake-revision:pet-onboarding-01'
const now = () => new Date('2026-08-27T10:00:00Z')

async function temporaryRoot(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-withdrawal-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function storedHarness(root, { grantOverride = {}, onPhase } = {}) {
  const storage = new FeedbackIntakeLocalStore({
    root,
    storeRef,
    now: () => new Date('2026-08-27T09:40:00Z'),
    resolveIntakeRevision: async () => structuredClone(revision),
    verifyReviewGrant: async (request) => ({
      authorized: true,
      capabilityId: request.capabilityId,
      effect: request.effect,
      storeRef: request.storeRef,
      intakeRevisionHash: request.intakeRevisionHash,
      grantReceiptRef: 'trusted-review-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:39:00Z',
      expiresAt: '2026-08-27T10:30:00Z',
    }),
  })
  const storageReceipt = await storage.persist({ storeRef, intakeRevisionRef: revisionRef, intakeRevisionHash: revision.intakeRevisionHash, reviewGrantRef: 'review-grant:feedback-intake-01', idempotencyKey: 'feedback-intake-01' })
  const input = {
    storeRef,
    storageReceiptRef: storageReceipt.receiptRef,
    recordDigest: storageReceipt.recordDigest,
    withdrawalRequestRef: 'withdrawal-request:feedback-intake-01',
    withdrawalMechanismRef: storageReceipt.withdrawalMechanismRef,
    withdrawalGrantRef: 'withdrawal-grant:feedback-intake-01',
    idempotencyKey: 'feedback-withdrawal-01',
  }
  const withdrawal = new FeedbackIntakeLocalWithdrawal({
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
      grantReceiptRef: 'trusted-withdrawal-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:59:00Z',
      expiresAt: '2026-08-27T10:30:00Z',
      ...grantOverride,
    }),
  })
  return { storage, storageReceipt, withdrawal, input }
}

test('deletes the exact stored record and commits a bounded logical-withdrawal receipt', async (context) => {
  const root = await temporaryRoot(context)
  const { withdrawal, input, storageReceipt } = await storedHarness(root)
  const receipt = await withdrawal.withdraw(input)
  assert.equal(receipt.status, 'withdrawn')
  assert.equal(receipt.storageReceiptRef, storageReceipt.receiptRef)
  assert.equal(receipt.recordDigest, storageReceipt.recordDigest)
  assert.equal(receipt.replayed, false)
  assert.equal(receipt.recordPresent, false)
  assert.equal(receipt.logicalDeletionApplied, true)
  assert.equal(receipt.withdrawalApplied, true)
  assert.equal(receipt.mediaSanitized || receipt.backupsPurged || receipt.downstreamCopiesDeleted || receipt.replySent || receipt.platformWritten || receipt.knowledgeWritten || receipt.executionAuthorized, false)
  assert.deepEqual(await withdrawal.listRecordFilesForVerification(), [])
  const files = await withdrawal.listWithdrawalFilesForVerification()
  assert.equal(files.length, 1)
  const journalPath = path.join(root, 'withdrawals', files[0])
  const journalText = await readFile(journalPath, 'utf8')
  const journal = JSON.parse(journalText)
  assert.equal(journal.state, 'committed')
  assert.equal(journal.receipt.withdrawalReceiptRef, receipt.withdrawalReceiptRef)
  assert.equal((await lstat(journalPath)).mode & 0o777, 0o600)
  assert.equal(journalText.includes(preparationInput.submission.answers[0].statement), false)
})

test('exact replay and concurrent withdrawal reconcile to one journal and one receipt', async (context) => {
  const root = await temporaryRoot(context)
  const { withdrawal, input } = await storedHarness(root)
  const concurrent = await Promise.all([withdrawal.withdraw(input), withdrawal.withdraw(input)])
  assert.deepEqual(concurrent.map((item) => item.replayed).sort(), [false, true])
  assert.equal(concurrent[0].withdrawalReceiptRef, concurrent[1].withdrawalReceiptRef)
  const replay = await withdrawal.withdraw(input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.withdrawalReceiptRef, concurrent[0].withdrawalReceiptRef)
  assert.deepEqual(await withdrawal.listRecordFilesForVerification(), [])
  assert.equal((await withdrawal.listWithdrawalFilesForVerification()).length, 1)
})

test('recovers both before-unlink and after-unlink interruption from the durable pending journal', async (context) => {
  for (const interruptedPhase of ['pending-created', 'record-unlinked']) {
    const root = await temporaryRoot(context)
    let interrupted = false
    const first = await storedHarness(root, { onPhase: async ({ phase }) => {
      if (!interrupted && phase === interruptedPhase) {
        interrupted = true
        throw new Error(`probe interruption after ${phase}`)
      }
    } })
    await assert.rejects(first.withdrawal.withdraw(first.input), /probe interruption/)
    const recovery = new FeedbackIntakeLocalWithdrawal({
      root,
      storeRef,
      now,
      verifyWithdrawalGrant: first.withdrawal.verifyWithdrawalGrant,
    })
    const receipt = await recovery.withdraw(first.input)
    assert.equal(receipt.replayed, true)
    assert.equal(receipt.logicalDeletionApplied, true)
    assert.deepEqual(await recovery.listRecordFilesForVerification(), [])
    const journal = JSON.parse(await readFile(path.join(root, 'withdrawals', (await recovery.listWithdrawalFilesForVerification())[0]), 'utf8'))
    assert.equal(journal.state, 'committed')
  }
})

test('fails closed on untrusted grants, missing proof, changed requests and tampered records', async (context) => {
  const untrustedRoot = await temporaryRoot(context)
  const untrusted = await storedHarness(untrustedRoot, { grantOverride: { authorized: false } })
  await assert.rejects(untrusted.withdrawal.withdraw(untrusted.input), /grant was rejected/)
  await assert.rejects(lstat(path.join(untrustedRoot, 'withdrawals')), { code: 'ENOENT' })

  const mismatchRoot = await temporaryRoot(context)
  const mismatch = await storedHarness(mismatchRoot, { grantOverride: { recordDigest: `sha256:${'f'.repeat(64)}` } })
  await assert.rejects(mismatch.withdrawal.withdraw(mismatch.input), /grant binding does not match/)

  const conflictRoot = await temporaryRoot(context)
  const conflict = await storedHarness(conflictRoot)
  await conflict.withdrawal.withdraw(conflict.input)
  await assert.rejects(conflict.withdrawal.withdraw({ ...conflict.input, idempotencyKey: 'feedback-withdrawal-other' }), /different withdrawal transaction/)

  const missingRoot = await temporaryRoot(context)
  const missing = await storedHarness(missingRoot)
  await rm(path.join(missingRoot, 'records'), { recursive: true })
  await assert.rejects(missing.withdrawal.withdraw(missing.input), /records directory does not exist/)

  const tamperedRoot = await temporaryRoot(context)
  const tampered = await storedHarness(tamperedRoot)
  const recordPath = path.join(tamperedRoot, 'records', (await tampered.storage.listRecordFilesForVerification())[0])
  const envelope = JSON.parse(await readFile(recordPath, 'utf8'))
  envelope.record.intakeRevision.submission.answers[0].statement += ' tampered'
  await writeFile(recordPath, `${JSON.stringify(envelope, null, 2)}\n`)
  await assert.rejects(tampered.withdrawal.withdraw(tampered.input), /record integrity mismatch/)
})

test('rejects public path injection, wrong stores and symlinked control directories', async (context) => {
  const root = await temporaryRoot(context)
  const { withdrawal, input } = await storedHarness(root)
  await assert.rejects(withdrawal.withdraw({ ...input, path: '/tmp/escape' }), /unsupported fields/)
  await assert.rejects(withdrawal.withdraw({ ...input, storeRef: 'feedback-store:other' }), /does not match configured/)

  const linkedRoot = await temporaryRoot(context)
  const linked = await storedHarness(linkedRoot)
  const elsewhere = await temporaryRoot(context)
  await rm(path.join(linkedRoot, 'withdrawals'), { recursive: true, force: true })
  await symlink(elsewhere, path.join(linkedRoot, 'withdrawals'))
  await assert.rejects(linked.withdrawal.withdraw(linked.input), /withdrawals directory must be a real directory/)
})

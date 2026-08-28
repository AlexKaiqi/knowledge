import assert from 'node:assert/strict'
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareConsentedFeedbackIntakeRevision } from '../../consented-feedback-intake-revision/src/index.mjs'
import { FeedbackIntakeLocalStore } from '../../feedback-intake-local-store/src/index.mjs'
import { FeedbackIntakeLocalRetentionExpiry } from '../src/index.mjs'

const preparationInput = JSON.parse(await readFile(new URL('../../../probes/fixtures/feedback/consented-intake.json', import.meta.url), 'utf8'))
const revision = prepareConsentedFeedbackIntakeRevision(preparationInput)
const storeRef = 'feedback-store:owner-primary'
const revisionRef = 'intake-revision:pet-onboarding-01'
const expiredNow = () => new Date('2027-02-23T08:00:01Z')

async function temporaryRoot(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-expiry-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function storedHarness(root, { grantOverride = {}, onPhase, now = expiredNow, onGrant } = {}) {
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
    retentionPolicyRef: revision.retention.policyRef,
    deleteAfter: storageReceipt.deleteAfter,
    retentionGrantRef: 'retention-grant:feedback-intake-01',
    idempotencyKey: 'feedback-retention-expiry-01',
  }
  const expiry = new FeedbackIntakeLocalRetentionExpiry({
    root,
    storeRef,
    now,
    onPhase,
    verifyRetentionGrant: async (request) => {
      onGrant?.(request)
      return {
        authorized: true,
        capabilityId: request.capabilityId,
        effect: request.effect,
        storeRef: request.storeRef,
        storageReceiptRef: request.storageReceiptRef,
        recordDigest: request.recordDigest,
        retentionPolicyRef: request.retentionPolicyRef,
        deleteAfter: request.deleteAfter,
        disposition: 'delete',
        holdStatus: 'clear',
        grantReceiptRef: 'trusted-retention-receipt:feedback-intake-01',
        authorizedAt: '2027-02-23T08:00:00Z',
        expiresAt: '2027-02-23T09:00:00Z',
        ...grantOverride,
      }
    },
  })
  return { storage, storageReceipt, expiry, input }
}

test('deletes an exactly due record and commits a retention-specific receipt', async (context) => {
  const root = await temporaryRoot(context)
  const { expiry, input, storageReceipt } = await storedHarness(root)
  const receipt = await expiry.expire(input)
  assert.equal(receipt.status, 'expired-and-deleted')
  assert.equal(receipt.storageReceiptRef, storageReceipt.receiptRef)
  assert.equal(receipt.retentionPolicyRef, revision.retention.policyRef)
  assert.equal(receipt.deleteAfter, storageReceipt.deleteAfter)
  assert.equal(receipt.replayed, false)
  assert.equal(receipt.recordPresent, false)
  assert.equal(receipt.retentionDeletionApplied, true)
  assert.equal(receipt.withdrawalApplied || receipt.mediaSanitized || receipt.backupsPurged || receipt.downstreamCopiesDeleted || receipt.replySent || receipt.platformWritten || receipt.knowledgeWritten || receipt.executionAuthorized, false)
  assert.deepEqual(await expiry.listRecordFilesForVerification(), [])
  const files = await expiry.listExpirationFilesForVerification()
  assert.equal(files.length, 1)
  const journalPath = path.join(root, 'retention-expirations', files[0])
  const journalText = await readFile(journalPath, 'utf8')
  assert.equal(JSON.parse(journalText).state, 'committed')
  assert.equal((await lstat(journalPath)).mode & 0o777, 0o600)
  assert.equal(journalText.includes(preparationInput.submission.answers[0].statement), false)
})

test('refuses early deletion before consulting a grant or creating control state', async (context) => {
  const root = await temporaryRoot(context)
  let grantCalls = 0
  const early = await storedHarness(root, { now: () => new Date('2027-02-23T07:59:59Z'), onGrant: () => { grantCalls += 1 } })
  await assert.rejects(early.expiry.expire(early.input), /not yet due/)
  assert.equal(grantCalls, 0)
  assert.equal((await early.storage.listRecordFilesForVerification()).length, 1)
  assert.equal((await early.expiry.listRetentionCandidatesForMaintenance({ now: new Date('2027-02-23T07:59:59Z') }))[0].due, false)
  assert.equal((await early.expiry.listRetentionCandidatesForMaintenance({ now: new Date('2027-02-23T08:00:00Z') }))[0].due, true)
  await assert.rejects(lstat(path.join(root, 'retention-expirations')), { code: 'ENOENT' })
})

test('exact replay and concurrent expiry reconcile to one journal and receipt', async (context) => {
  const root = await temporaryRoot(context)
  const { expiry, input } = await storedHarness(root)
  const concurrent = await Promise.all([expiry.expire(input), expiry.expire(input)])
  assert.deepEqual(concurrent.map((item) => item.replayed).sort(), [false, true])
  assert.equal(concurrent[0].retentionDeletionReceiptRef, concurrent[1].retentionDeletionReceiptRef)
  const replay = await expiry.expire(input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.retentionDeletionReceiptRef, concurrent[0].retentionDeletionReceiptRef)
  assert.equal((await expiry.listExpirationFilesForVerification()).length, 1)
})

test('fails closed on holds, untrusted grants, deadline drift and changed transactions', async (context) => {
  const holdRoot = await temporaryRoot(context)
  const hold = await storedHarness(holdRoot, { grantOverride: { holdStatus: 'active' } })
  await assert.rejects(hold.expiry.expire(hold.input), /reports a hold/)
  await assert.rejects(lstat(path.join(holdRoot, 'retention-expirations')), { code: 'ENOENT' })

  const untrustedRoot = await temporaryRoot(context)
  const untrusted = await storedHarness(untrustedRoot, { grantOverride: { authorized: false } })
  await assert.rejects(untrusted.expiry.expire(untrusted.input), /grant was rejected/)

  const deadlineRoot = await temporaryRoot(context)
  const deadline = await storedHarness(deadlineRoot)
  await assert.rejects(deadline.expiry.expire({ ...deadline.input, deleteAfter: '2027-02-24T08:00:00Z' }), /deadline does not match/)

  const conflictRoot = await temporaryRoot(context)
  const conflict = await storedHarness(conflictRoot)
  await conflict.expiry.expire(conflict.input)
  await assert.rejects(conflict.expiry.expire({ ...conflict.input, idempotencyKey: 'feedback-retention-other' }), /different retention expiry transaction/)
})

test('recovers post-unlink interruption and rejects tampering, paths and symlinked state', async (context) => {
  const recoveryRoot = await temporaryRoot(context)
  let interrupted = false
  const first = await storedHarness(recoveryRoot, { onPhase: async ({ phase }) => {
    if (!interrupted && phase === 'record-unlinked') {
      interrupted = true
      throw new Error('probe interruption after record unlink')
    }
  } })
  await assert.rejects(first.expiry.expire(first.input), /probe interruption/)
  const recovery = new FeedbackIntakeLocalRetentionExpiry({ root: recoveryRoot, storeRef, now: expiredNow, verifyRetentionGrant: first.expiry.verifyRetentionGrant })
  const receipt = await recovery.expire(first.input)
  assert.equal(receipt.replayed, true)
  assert.deepEqual(await recovery.listRecordFilesForVerification(), [])

  const tamperedRoot = await temporaryRoot(context)
  const tampered = await storedHarness(tamperedRoot)
  const recordPath = path.join(tamperedRoot, 'records', (await tampered.storage.listRecordFilesForVerification())[0])
  const envelope = JSON.parse(await readFile(recordPath, 'utf8'))
  envelope.record.intakeRevision.retention.policyRef = 'retention:tampered'
  await writeFile(recordPath, `${JSON.stringify(envelope, null, 2)}\n`)
  await assert.rejects(tampered.expiry.expire(tampered.input), /record integrity mismatch/)
  await assert.rejects(tampered.expiry.expire({ ...tampered.input, path: '/tmp/escape' }), /unsupported fields/)

  const linkedRoot = await temporaryRoot(context)
  const linked = await storedHarness(linkedRoot)
  const elsewhere = await temporaryRoot(context)
  await symlink(elsewhere, path.join(linkedRoot, 'retention-expirations'))
  await assert.rejects(linked.expiry.expire(linked.input), /retention expirations directory must be a real directory/)
})

import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareConsentedFeedbackIntakeRevision } from '../../consented-feedback-intake-revision/src/index.mjs'
import { FeedbackIntakeLocalStore } from '../src/index.mjs'

const preparationInput = JSON.parse(await readFile(new URL('../../../probes/fixtures/feedback/consented-intake.json', import.meta.url), 'utf8'))
const revisionRef = 'intake-revision:pet-onboarding-01'
const storeRef = 'feedback-store:owner-primary'
const grantRef = 'review-grant:feedback-intake-01'
const now = () => new Date('2026-08-27T09:40:00Z')

function harness(root, revision = prepareConsentedFeedbackIntakeRevision(preparationInput), grantOverride = {}) {
  const store = new FeedbackIntakeLocalStore({
    root,
    storeRef,
    now,
    resolveIntakeRevision: async (ref) => {
      assert.equal(ref, revisionRef)
      return structuredClone(revision)
    },
    verifyReviewGrant: async (request) => ({
      authorized: true,
      capabilityId: request.capabilityId,
      effect: request.effect,
      storeRef: request.storeRef,
      intakeRevisionHash: request.intakeRevisionHash,
      grantReceiptRef: 'trusted-review-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:39:00Z',
      expiresAt: '2026-08-27T10:00:00Z',
      ...grantOverride,
    }),
  })
  const input = { storeRef, intakeRevisionRef: revisionRef, intakeRevisionHash: revision.intakeRevisionHash, reviewGrantRef: grantRef, idempotencyKey: 'feedback-intake-01' }
  return { store, input, revision }
}

async function temporaryStore(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-store-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('atomically stores the exact reviewed revision and returns a bounded receipt', async (context) => {
  const root = await temporaryStore(context)
  const { store, input, revision } = harness(root)
  const receipt = await store.persist(input)
  assert.equal(receipt.status, 'stored')
  assert.equal(receipt.intakeRevisionHash, revision.intakeRevisionHash)
  assert.equal(receipt.replayed, false)
  assert.equal(receipt.stored, true)
  assert.equal(receipt.withdrawalApplied || receipt.replySent || receipt.platformWritten || receipt.knowledgeWritten || receipt.executionAuthorized, false)
  const files = await store.listRecordFilesForVerification()
  assert.equal(files.length, 1)
  const filePath = path.join(root, 'records', files[0])
  const envelope = JSON.parse(await readFile(filePath, 'utf8'))
  assert.equal(envelope.record.intakeRevisionHash, revision.intakeRevisionHash)
  assert.equal(envelope.record.intakeRevision.submission.answers.length, 2)
  assert.equal(envelope.receipt.recordDigest, receipt.recordDigest)
  assert.equal((await lstat(filePath)).mode & 0o777, 0o600)
})

test('exact replay is idempotent and concurrent writers create one record', async (context) => {
  const root = await temporaryStore(context)
  const { store, input } = harness(root)
  const concurrent = await Promise.all([store.persist(input), store.persist(input)])
  assert.deepEqual(concurrent.map((item) => item.replayed).sort(), [false, true])
  const replay = await store.persist(input)
  assert.equal(replay.replayed, true)
  assert.equal(replay.receiptRef, concurrent[0].receiptRef)
  assert.equal((await store.listRecordFilesForVerification()).length, 1)
})

test('same submission cannot be silently replaced by another revision or idempotency key', async (context) => {
  const root = await temporaryStore(context)
  const first = harness(root)
  await first.store.persist(first.input)
  await assert.rejects(first.store.persist({ ...first.input, idempotencyKey: 'feedback-intake-other' }), /different revision or idempotency key/)

  const changedInput = structuredClone(preparationInput)
  changedInput.submission.answers[0].statement += ' This changed after review.'
  const changedRevision = prepareConsentedFeedbackIntakeRevision(changedInput)
  const changed = harness(root, changedRevision)
  await assert.rejects(changed.store.persist(changed.input), /different revision or idempotency key/)
})

test('fails closed on untrusted, mismatched or expired grants and revision drift', async (context) => {
  const root = await temporaryStore(context)
  await assert.rejects(harness(root, undefined, { authorized: false }).store.persist(harness(root).input), /grant was rejected/)
  const mismatched = harness(root, undefined, { storeRef: 'feedback-store:other' })
  await assert.rejects(mismatched.store.persist(mismatched.input), /binding does not match/)
  const expired = harness(root, undefined, { expiresAt: '2026-08-27T09:39:59Z' })
  await assert.rejects(expired.store.persist(expired.input), /not currently valid/)

  const tamperedRevision = prepareConsentedFeedbackIntakeRevision(preparationInput)
  tamperedRevision.submission.answers[0].statement += ' tampered'
  const tampered = harness(root, tamperedRevision)
  await assert.rejects(tampered.store.persist(tampered.input), /not the exact ready revision|canonical preparation/)
})

test('rejects public path injection, wrong store and symlinked storage directories', async (context) => {
  const root = await temporaryStore(context)
  const { store, input } = harness(root)
  await assert.rejects(store.persist({ ...input, path: '/tmp/escape' }), /unsupported fields/)
  await assert.rejects(store.persist({ ...input, storeRef: 'feedback-store:other' }), /does not match configured/)

  const linkedRoot = await temporaryStore(context)
  const elsewhere = await temporaryStore(context)
  await mkdir(path.join(linkedRoot), { recursive: true })
  await symlink(elsewhere, path.join(linkedRoot, 'records'))
  const linked = harness(linkedRoot)
  await assert.rejects(linked.store.persist(linked.input), /must be a real directory/)
})

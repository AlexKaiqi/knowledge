import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareDurableMemoryChangeReviewRevision } from '../src/index.mjs'

const content = '# Preferences\n\n- Quiet hours: 22:00–08:00.\n'
const input = {
  ownerScopeRef: 'owner:primary',
  repositoryRevisionRef: 'git:c8e181adcf3904f47fd33b85ffc1e97126cbbd66',
  target: { path: 'knowledge/preferences.md', exists: false, contentDigest: null },
  change: {
    operation: 'upsert',
    baseContentDigest: null,
    content,
    reason: 'Confirmed stable preference should survive the current task.',
    sourceRefs: ['session:fixture-1'],
    evidenceRefs: ['confirmation:fixture-1'],
  },
}

test('prepares a deterministic exact-content review revision without applying it', () => {
  const first = prepareDurableMemoryChangeReviewRevision(input, { now: () => new Date('2026-08-27T06:00:00Z') })
  const replay = prepareDurableMemoryChangeReviewRevision({ ...input, change: { ...input.change, sourceRefs: [...input.change.sourceRefs] } }, { now: () => new Date('2026-08-28T06:00:00Z') })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.reviewRevisionHash, replay.reviewRevisionHash)
  assert.equal(first.change.desiredContentDigest, 'sha256:f2fb57304f3078bc16b3dd106e72b89c0fdd002ad2045197d5f4699023ac3828')
  assert.equal(first.reviewItems.length, 7)
  assert.equal(first.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(first.reviewerDecision, null)
  assert.equal(first.proposalCreated, false)
  assert.equal(first.applied, false)
  assert.equal(first.committed, false)
  assert.equal(first.receiptIssued, false)
  assert.equal(first.executionAuthorized, false)
})

test('binds path, exact content, base digest and provenance into the revision', () => {
  const base = prepareDurableMemoryChangeReviewRevision(input)
  const variants = [
    { ...input, target: { ...input.target, path: 'knowledge/routines.md' } },
    { ...input, change: { ...input.change, content: `${content}\n- Prefer text updates.` } },
    { ...input, change: { ...input.change, baseContentDigest: `sha256:${'a'.repeat(64)}` }, target: { ...input.target, exists: true, contentDigest: `sha256:${'a'.repeat(64)}` } },
    { ...input, change: { ...input.change, evidenceRefs: ['confirmation:fixture-2'] } },
  ]
  for (const variant of variants) assert.notEqual(prepareDurableMemoryChangeReviewRevision(variant).reviewRevisionHash, base.reviewRevisionHash)
})

test('blocks stale target state but recognizes idempotent replay', () => {
  const stale = prepareDurableMemoryChangeReviewRevision({
    ...input,
    target: { ...input.target, exists: true, contentDigest: `sha256:${'b'.repeat(64)}` },
  })
  assert.equal(stale.status, 'blocked')
  assert.equal(stale.reviewRevisionHash, null)
  assert.deepEqual(stale.preflight.blockers[0], {
    code: 'target-changed-after-proposal',
    expectedBaseContentDigest: null,
    currentContentDigest: `sha256:${'b'.repeat(64)}`,
  })

  const desired = prepareDurableMemoryChangeReviewRevision(input).change.desiredContentDigest
  const replay = prepareDurableMemoryChangeReviewRevision({ ...input, target: { ...input.target, exists: true, contentDigest: desired } })
  assert.equal(replay.status, 'already-satisfied')
  assert.equal(replay.reviewRevisionHash, null)
  assert.deepEqual(replay.reviewItems, [])
})

test('prepares bounded delete review and recognizes an already absent target', () => {
  const digest = `sha256:${'c'.repeat(64)}`
  const deletion = { ...input, target: { path: 'USER.md', exists: true, contentDigest: digest }, change: { ...input.change, operation: 'delete', baseContentDigest: digest, content: null } }
  assert.equal(prepareDurableMemoryChangeReviewRevision(deletion).status, 'ready-for-human-review')
  const absent = { ...deletion, target: { path: 'USER.md', exists: false, contentDigest: null } }
  assert.equal(prepareDurableMemoryChangeReviewRevision(absent).status, 'already-satisfied')
})

test('rejects hidden authority, unsafe paths, incoherent state and invalid operation payloads', () => {
  assert.throws(() => prepareDurableMemoryChangeReviewRevision({ ...input, confirmed: true }), /unsupported fields/)
  assert.throws(() => prepareDurableMemoryChangeReviewRevision({ ...input, target: { ...input.target, path: 'knowledge/nested/file.md' } }), /directly inside/)
  assert.throws(() => prepareDurableMemoryChangeReviewRevision({ ...input, target: { ...input.target, exists: true } }), /inconsistent/)
  assert.throws(() => prepareDurableMemoryChangeReviewRevision({ ...input, change: { ...input.change, operation: 'delete' } }), /delete content must be null/)
  assert.throws(() => prepareDurableMemoryChangeReviewRevision({ ...input, change: { ...input.change, sourceRefs: ['same', 'same'] } }), /unique/)
})

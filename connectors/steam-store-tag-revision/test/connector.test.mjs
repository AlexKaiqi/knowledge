import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamStoreTagReviewRevision } from '../src/index.mjs'

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'design:launch-v1',
  catalogRevisionRef: 'steam-tags:observed-2026-08-27',
  tags: ['Puzzle', 'Atmospheric', 'Exploration', 'Singleplayer', 'Story Rich', 'Indie'].map((displayName) => ({ tagRef: `steam-tag:${displayName.toLowerCase().replace(' ', '-')}`, displayName, launchEvidenceRefs: [`design:${displayName.toLowerCase().replace(' ', '-')}`] })),
  audienceEvidenceRefs: ['research:comparable-tag-pages-v1']
}

test('freezes ordered Steam tags into a deterministic human-review revision', () => {
  const result = prepareSteamStoreTagReviewRevision(input, { now: () => new Date('2026-08-27T00:00:00Z') })
  const replay = prepareSteamStoreTagReviewRevision(input, { now: () => new Date('2026-08-28T00:00:00Z') })
  assert.equal(result.status, 'ready-for-human-review')
  assert.equal(result.revisionHash, replay.revisionHash)
  assert.deepEqual(result.tags.map((item) => [item.rank, item.topFive]), [[1, true], [2, true], [3, true], [4, true], [5, true], [6, false]])
  assert.equal(result.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(result.platformValidated || result.savedToSteamworks || result.published || result.markedReadyForReview || result.released || result.executionAuthorized, false)
})

test('order, tag identity, launch evidence and catalog revision invalidate the revision', () => {
  const base = prepareSteamStoreTagReviewRevision(input).revisionHash
  const reordered = structuredClone(input); [reordered.tags[0], reordered.tags[1]] = [reordered.tags[1], reordered.tags[0]]
  const renamed = structuredClone(input); renamed.tags[0].displayName = 'Logic'
  const evidence = structuredClone(input); evidence.tags[0].launchEvidenceRefs.push('build:feature-proof')
  assert.notEqual(prepareSteamStoreTagReviewRevision(reordered).revisionHash, base)
  assert.notEqual(prepareSteamStoreTagReviewRevision(renamed).revisionHash, base)
  assert.notEqual(prepareSteamStoreTagReviewRevision(evidence).revisionHash, base)
  assert.notEqual(prepareSteamStoreTagReviewRevision({ ...input, catalogRevisionRef: 'steam-tags:new' }).revisionHash, base)
})

test('blocks too few, too many, duplicate refs and duplicate display names', () => {
  assert.equal(prepareSteamStoreTagReviewRevision({ ...input, tags: input.tags.slice(0, 4) }).status, 'blocked')
  const tooMany = Array.from({ length: 21 }, (_, index) => ({ tagRef: `tag:${index}`, displayName: `Tag ${index}`, launchEvidenceRefs: [`evidence:${index}`] }))
  assert.equal(prepareSteamStoreTagReviewRevision({ ...input, tags: tooMany }).status, 'blocked')
  const duplicateRef = structuredClone(input); duplicateRef.tags[1].tagRef = duplicateRef.tags[0].tagRef
  assert.equal(prepareSteamStoreTagReviewRevision(duplicateRef).preflight.blockers.some((item) => item.code === 'duplicate-tag-ref'), true)
  const duplicateName = structuredClone(input); duplicateName.tags[1].displayName = 'puzzle'
  assert.equal(prepareSteamStoreTagReviewRevision(duplicateName).preflight.blockers.some((item) => item.code === 'duplicate-tag-name'), true)
})

test('rejects hidden authority, private fields and malformed display content', () => {
  assert.throws(() => prepareSteamStoreTagReviewRevision({ ...input, approved: true }), /unsupported fields/)
  const secret = structuredClone(input); secret.tags[0].rawPlatformResponse = 'secret'
  assert.throws(() => prepareSteamStoreTagReviewRevision(secret), /unsupported fields/)
  const newline = structuredClone(input); newline.tags[0].displayName = 'Puzzle\nGame'
  assert.throws(() => prepareSteamStoreTagReviewRevision(newline), /control/)
})

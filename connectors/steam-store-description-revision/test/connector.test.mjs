import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamStoreDescriptionReviewRevision } from '../src/index.mjs'

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'git:demo-store-copy-v1',
  localizations: [
    {
      language: 'english',
      shortDescription: 'Guide a tiny clockwork familiar through shifting rooms where every sound changes the path.',
      aboutThisGame: 'Guide a clockwork familiar through an ever-changing house. Listen for hidden mechanisms, solve compact spatial puzzles, and choose which memories the familiar carries into the next room.\n\nThe launch build contains a complete single-player journey with keyboard and controller support.',
      translationBasisRef: 'copy:owned-english-draft-v1',
    },
    {
      language: 'schinese',
      shortDescription: '引导一只发条使魔穿过不断变化的房间，每一种声音都会改变前路。',
      aboutThisGame: '引导发条使魔探索一座不断变化的房屋。聆听隐藏机关，解开紧凑的空间谜题，并决定使魔要将哪些记忆带入下一个房间。\n\n首发版本包含完整的单人旅程，并支持键盘与控制器。',
      translationBasisRef: 'translation:schinese-human-review-v1',
    },
  ],
  launchFeatureRefs: ['build:probe-demo-v1', 'design:launch-feature-ledger-v1'],
  rightsBasisRefs: ['rights:owned-game-copy-v1'],
}

test('prepares a deterministic localized description revision without platform authority', () => {
  const first = prepareSteamStoreDescriptionReviewRevision(input, { now: () => new Date('2026-08-27T04:00:00Z') })
  const replay = prepareSteamStoreDescriptionReviewRevision({ ...input, localizations: [...input.localizations].reverse() }, { now: () => new Date('2026-08-28T04:00:00Z') })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.revisionHash, replay.revisionHash)
  assert.equal(first.localizations[0].language, 'english')
  assert.equal(first.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(first.uploaded || first.published || first.markedReadyForReview || first.released || first.executionAuthorized, false)
})

test('copy, evidence and translation changes invalidate the revision', () => {
  const baseline = prepareSteamStoreDescriptionReviewRevision(input).revisionHash
  const editedCopy = structuredClone(input)
  editedCopy.localizations[0].shortDescription += ' Quietly.'
  const editedEvidence = { ...input, launchFeatureRefs: [...input.launchFeatureRefs, 'build:probe-demo-v2'] }
  const editedTranslation = structuredClone(input)
  editedTranslation.localizations[1].translationBasisRef = 'translation:schinese-human-review-v2'
  assert.notEqual(prepareSteamStoreDescriptionReviewRevision(editedCopy).revisionHash, baseline)
  assert.notEqual(prepareSteamStoreDescriptionReviewRevision(editedEvidence).revisionHash, baseline)
  assert.notEqual(prepareSteamStoreDescriptionReviewRevision(editedTranslation).revisionHash, baseline)
})

test('blocks missing English, unsupported languages, markup, links and local budgets', () => {
  const withoutEnglish = { ...input, localizations: input.localizations.filter((item) => item.language !== 'english') }
  assert.equal(prepareSteamStoreDescriptionReviewRevision(withoutEnglish).preflight.blockers.some((item) => item.code === 'english-fallback-required'), true)
  const unsupported = structuredClone(input)
  unsupported.localizations[1].language = 'esperanto'
  assert.equal(prepareSteamStoreDescriptionReviewRevision(unsupported).preflight.blockers.some((item) => item.code === 'unsupported-store-language'), true)
  const linked = structuredClone(input)
  linked.localizations[0].aboutThisGame += '\nVisit example.com for more.'
  assert.equal(prepareSteamStoreDescriptionReviewRevision(linked).preflight.blockers.some((item) => item.code === 'description-link-not-allowed'), true)
  const markedUp = structuredClone(input)
  markedUp.localizations[0].shortDescription = '[b]A game[/b]'
  assert.equal(prepareSteamStoreDescriptionReviewRevision(markedUp).preflight.blockers.some((item) => item.code === 'short-description-must-be-plain-single-line'), true)
  assert.equal(prepareSteamStoreDescriptionReviewRevision(input, { maxShortDescriptionCodePoints: 10 }).preflight.blockers.some((item) => item.code === 'short-description-budget-exceeded'), true)
})

test('rejects hidden fields, duplicate refs, malformed language codes and non-NFC copy', () => {
  assert.throws(() => prepareSteamStoreDescriptionReviewRevision({ ...input, steamAppId: 123 }), /unsupported fields/)
  assert.throws(() => prepareSteamStoreDescriptionReviewRevision({ ...input, rightsBasisRefs: ['rights:x', 'rights:x'] }), /must be unique/)
  const invalidLanguage = structuredClone(input)
  invalidLanguage.localizations[0].language = '../english'
  assert.throws(() => prepareSteamStoreDescriptionReviewRevision(invalidLanguage), /language is invalid/)
  const nonNfc = structuredClone(input)
  nonNfc.localizations[0].shortDescription = 'Cafe\u0301 puzzle'
  assert.throws(() => prepareSteamStoreDescriptionReviewRevision(nonNfc), /NFC-normalized/)
})

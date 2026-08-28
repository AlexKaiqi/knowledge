import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamEarlyAccessReviewRevision } from '../src/index.mjs'

const questions = ['why-early-access', 'approximate-duration', 'planned-full-version-differences', 'current-early-access-state', 'pricing-during-and-after', 'community-involvement']
const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'design:early-access-plan-v2',
  buildRevisionRef: 'build:steam-early-access-candidate-v4',
  questionnaireRevisionRef: 'steam-early-access-qa:observed-2026-08-27',
  answers: questions.map((questionRef) => ({ questionRef, text: `Transparent draft answer for ${questionRef}.`, evidenceRefs: [`evidence:${questionRef}`] })),
  currentBuild: {
    playabilityState: 'playable-current-build',
    playableEvidenceRefs: ['test:full-run-v4'],
    gameplayTrailerEvidenceRefs: ['media:gameplay-trailer-v2'],
    currentFeatureRefs: ['feature:exploration-loop', 'feature:companion-dialogue'],
    currentLimitationRefs: ['limitation:chapter-count', 'limitation:save-break-risk'],
  },
  eligibility: {
    developmentState: 'actively-in-development',
    fundingDependency: 'not-dependent-on-early-access-sales',
    futurePlanCommitment: 'non-binding-and-changeable',
    communityInfluence: 'planned-and-material',
  },
  pricePlan: {
    currentPriceRevisionRef: 'price-plan:early-access-v1',
    futurePriceDirection: 'higher',
    steamPriceParity: 'confirmed-no-higher',
    transparencyEvidenceRefs: ['copy:pricing-answer-v1'],
    otherServiceAvailability: 'planned-or-active',
    otherServicePriceEvidenceRefs: ['price-proof:other-store-v1'],
  },
  thirdPartyDistribution: { mode: 'steam-key-sites', disclosureEvidenceRefs: ['disclosure:key-site-v1'] },
}

test('freezes six Early Access answers and eligibility evidence into a deterministic revision', () => {
  const result = prepareSteamEarlyAccessReviewRevision(input, { now: () => new Date('2026-08-27T00:00:00Z') })
  const replay = prepareSteamEarlyAccessReviewRevision(input, { now: () => new Date('2026-08-28T00:00:00Z') })
  assert.equal(result.status, 'ready-for-human-review')
  assert.equal(result.revisionHash, replay.revisionHash)
  assert.deepEqual(result.answers.map((item) => item.questionRef), questions)
  assert.equal(result.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(result.platformValidated || result.buildValidatedByConnector || result.priceValidated || result.savedToSteamworks || result.published || result.markedReadyForReview || result.releasedAsEarlyAccess || result.executionAuthorized, false)
})

test('binds build, questionnaire, answers, eligibility, pricing and disclosures', () => {
  const base = prepareSteamEarlyAccessReviewRevision(input).revisionHash
  const cases = [{ ...input, buildRevisionRef: 'build:steam-early-access-candidate-v5' }, { ...input, questionnaireRevisionRef: 'steam-early-access-qa:observed-next' }]
  const answer = structuredClone(input); answer.answers[0].text += ' Revised.'; cases.push(answer)
  const feature = structuredClone(input); feature.currentBuild.currentFeatureRefs.push('feature:new-loop'); cases.push(feature)
  const price = structuredClone(input); price.pricePlan.futurePriceDirection = 'same'; cases.push(price)
  const disclosure = structuredClone(input); disclosure.thirdPartyDistribution.disclosureEvidenceRefs.push('disclosure:second-site'); cases.push(disclosure)
  for (const candidate of cases) assert.notEqual(prepareSteamEarlyAccessReviewRevision(candidate).revisionHash, base)
})

test('blocks missing answers, non-playable builds, promises and ineligible use', () => {
  const missing = structuredClone(input); missing.answers.pop()
  assert.equal(prepareSteamEarlyAccessReviewRevision(missing).preflight.blockers.some((item) => item.code === 'missing-question-answer'), true)
  const unplayable = structuredClone(input); unplayable.currentBuild.playabilityState = 'not-playable'
  assert.equal(prepareSteamEarlyAccessReviewRevision(unplayable).preflight.blockers.some((item) => item.code === 'current-build-not-playable'), true)
  const promises = structuredClone(input); promises.eligibility.futurePlanCommitment = 'specific-promises'
  assert.equal(prepareSteamEarlyAccessReviewRevision(promises).preflight.blockers.some((item) => item.code === 'specific-future-promises'), true)
  const finished = structuredClone(input); finished.eligibility.developmentState = 'finished-or-bugfix-only'
  assert.equal(prepareSteamEarlyAccessReviewRevision(finished).preflight.blockers.some((item) => item.code === 'development-already-finished'), true)
  const dependent = structuredClone(input); dependent.eligibility.fundingDependency = 'dependent-on-early-access-sales'
  assert.equal(prepareSteamEarlyAccessReviewRevision(dependent).preflight.blockers.some((item) => item.code === 'completion-depends-on-early-access-sales'), true)
})

test('blocks pricing/disclosure conflicts and rejects hidden authority', () => {
  const higher = structuredClone(input); higher.pricePlan.steamPriceParity = 'higher-than-other-service'
  assert.equal(prepareSteamEarlyAccessReviewRevision(higher).preflight.blockers.some((item) => item.code === 'steam-price-higher-than-other-service'), true)
  const missingComparison = structuredClone(input); missingComparison.pricePlan.otherServicePriceEvidenceRefs = []
  assert.equal(prepareSteamEarlyAccessReviewRevision(missingComparison).preflight.blockers.some((item) => item.code === 'missing-other-service-price-evidence'), true)
  const missingDisclosure = structuredClone(input); missingDisclosure.thirdPartyDistribution.disclosureEvidenceRefs = []
  assert.equal(prepareSteamEarlyAccessReviewRevision(missingDisclosure).preflight.blockers.some((item) => item.code === 'missing-third-party-early-access-disclosure'), true)
  assert.throws(() => prepareSteamEarlyAccessReviewRevision({ ...input, approved: true }), /unsupported fields/)
  const hidden = structuredClone(input); hidden.answers[0].platformResponse = 'secret'
  assert.throws(() => prepareSteamEarlyAccessReviewRevision(hidden), /unsupported fields/)
})

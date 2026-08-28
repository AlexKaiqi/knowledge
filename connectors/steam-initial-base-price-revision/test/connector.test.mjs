import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamInitialBasePriceReviewRevision, STEAM_INITIAL_PRICE_MARKETS } from '../src/index.mjs'

const increments = { CLP: 100, COP: 100, CRC: 500, IDR: 100, INR: 100, JPY: 100, KRW: 1000, KZT: 100, TWD: 100, UAH: 100, UYU: 100, VND: 50000 }
const pricePoints = STEAM_INITIAL_PRICE_MARKETS.map((marketCode) => {
  const step = increments[marketCode] ?? 1
  return { marketCode, amountMinorUnits: step * 999, observedMinimumBaseMinorUnits: step * 99 }
})
const now = () => new Date('2026-08-27T12:00:00.000Z')
const input = {
  gameRef: 'game:clockwork-familiar', sourceRevisionRef: 'source:steam-pricing-2026-08-27', pricingCatalogRevisionRef: 'catalog:steam-live-currencies-v3', minimumThresholdRevisionRef: 'thresholds:steam-2026-08-27', packageRef: 'package:standard-base-game', buildRevisionRef: 'revision:owned-build-v4',
  observedPricingState: { observedAt: '2026-08-27T08:00:00.000Z', releaseState: 'unreleased', packageState: 'standard-package-present', pricingSubmissionState: 'not-submitted', currentPriceScheduleDigest: null, activeOrScheduledDiscount: false, evidenceRefs: ['evidence:package-state', 'evidence:pricing-dashboard'] },
  target: { packageKind: 'standard-base-game', publishMode: 'partner-manual-publish-after-review', pricePoints, marketResearchEvidenceRefs: ['evidence:comparable-games'], valueEvidenceRefs: ['evidence:current-build-value'] },
}

test('freezes a complete initial base-price schedule without platform effects', () => {
  const first = prepareSteamInitialBasePriceReviewRevision(input, { now })
  const replay = prepareSteamInitialBasePriceReviewRevision(input, { now: () => new Date('2026-08-27T13:00:00.000Z') })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.revisionHash, replay.revisionHash)
  assert.equal(first.coverage.liveCurrencyCount, 37)
  assert.equal(first.coverage.usdRegionGroupCount, 4)
  assert.equal(first.coverage.completeObservedMarketSet, true)
  assert.equal(first.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(first.platformStateAuthenticated || first.priceValidityConfirmed || first.csvGenerated || first.submittedToValve || first.approvedByValve || first.publishedToSteam || first.discountConfigured || first.executionAuthorized, false)
})

test('binds package, catalogs, evidence, publish mode and every regional amount', () => {
  const base = prepareSteamInitialBasePriceReviewRevision(input, { now }).revisionHash
  const mutations = [
    { ...input, packageRef: 'package:standard-base-game-v2' },
    { ...input, pricingCatalogRevisionRef: 'catalog:steam-live-currencies-v4' },
    { ...input, minimumThresholdRevisionRef: 'thresholds:steam-2026-08-28' },
    { ...input, buildRevisionRef: 'revision:owned-build-v5' },
    { ...input, target: { ...input.target, publishMode: 'valve-publish-after-review' } },
    { ...input, target: { ...input.target, marketResearchEvidenceRefs: ['evidence:comparable-games-v2'] } },
    { ...input, target: { ...input.target, pricePoints: input.target.pricePoints.map((point) => point.marketCode === 'USD' ? { ...point, amountMinorUnits: point.amountMinorUnits + 1 } : point) } },
  ]
  for (const mutation of mutations) assert.notEqual(prepareSteamInitialBasePriceReviewRevision(mutation, { now }).revisionHash, base)
})

test('blocks incomplete coverage, observed minimum violations and invalid increments', () => {
  const incomplete = structuredClone(input); incomplete.target.pricePoints.pop()
  const low = structuredClone(input); low.target.pricePoints.find((point) => point.marketCode === 'USD').amountMinorUnits = 98
  const increment = structuredClone(input); increment.target.pricePoints.find((point) => point.marketCode === 'JPY').amountMinorUnits += 1
  assert.equal(prepareSteamInitialBasePriceReviewRevision(incomplete, { now }).preflight.blockers.some((item) => item.code === 'missing-market-prices'), true)
  assert.equal(prepareSteamInitialBasePriceReviewRevision(low, { now }).preflight.blockers.some((item) => item.code === 'price-below-observed-minimum'), true)
  assert.equal(prepareSteamInitialBasePriceReviewRevision(increment, { now }).preflight.blockers.some((item) => item.code === 'currency-increment-invalid'), true)
})

test('blocks stale, released, missing-package and pre-existing pricing states', () => {
  const cases = [
    [{ ...input, observedPricingState: { ...input.observedPricingState, observedAt: '2026-08-25T08:00:00.000Z' } }, 'observed-state-stale'],
    [{ ...input, observedPricingState: { ...input.observedPricingState, releaseState: 'released' } }, 'already-released'],
    [{ ...input, observedPricingState: { ...input.observedPricingState, packageState: 'missing' } }, 'standard-package-missing'],
    [{ ...input, observedPricingState: { ...input.observedPricingState, pricingSubmissionState: 'under-review' } }, 'initial-pricing-already-submitted'],
    [{ ...input, observedPricingState: { ...input.observedPricingState, currentPriceScheduleDigest: `sha256:${'a'.repeat(64)}` } }, 'existing-price-schedule-requires-update-capability'],
    [{ ...input, observedPricingState: { ...input.observedPricingState, activeOrScheduledDiscount: true } }, 'discount-state-conflicts-with-base-price-preparation'],
  ]
  for (const [fixture, code] of cases) assert.equal(prepareSteamInitialBasePriceReviewRevision(fixture, { now }).preflight.blockers.some((item) => item.code === code), true, code)
})

test('rejects hidden authority, unsafe references and duplicate market codes', () => {
  assert.throws(() => prepareSteamInitialBasePriceReviewRevision({ ...input, submit: true }, { now }), /unsupported fields/)
  assert.throws(() => prepareSteamInitialBasePriceReviewRevision({ ...input, gameRef: '../game' }, { now }), /opaque and bounded/)
  assert.throws(() => prepareSteamInitialBasePriceReviewRevision({ ...input, observedPricingState: { ...input.observedPricingState, credentialRef: 'secret' } }, { now }), /unsupported fields/)
  assert.throws(() => prepareSteamInitialBasePriceReviewRevision({ ...input, target: { ...input.target, pricePoints: [...input.target.pricePoints, input.target.pricePoints[0]] } }, { now }), /unique/)
})

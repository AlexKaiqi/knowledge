import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamInitialReleaseDateReviewRevision } from '../src/index.mjs'

const now = () => new Date('2026-08-27T12:00:00.000Z')
const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'source:steam-release-rules-2026-08-27',
  storeRevisionRef: 'revision:steam-store-page-v7',
  buildRevisionRef: 'revision:owned-build-v4',
  observedReleaseState: {
    observedAt: '2026-08-27T08:00:00.000Z',
    releaseState: 'not-released',
    specifiedReleaseDate: '2026-10-30',
    playerFacingDisplay: 'coming-soon',
    comingSoonPublishedDate: '2026-08-01',
    storePresenceReviewState: 'ready-for-release',
    buildReviewState: 'ready-for-release',
    evidenceRefs: ['evidence:build-review', 'evidence:coming-soon', 'evidence:store-review'],
  },
  target: {
    specifiedReleaseDate: '2026-10-30',
    playerFacingDisplay: 'month-year',
    decisionEvidenceRefs: ['decision:launch-plan-v3'],
  },
}

test('freezes an exact intended date while deriving bounded player-facing placement', () => {
  const first = prepareSteamInitialReleaseDateReviewRevision(input, { now })
  const second = prepareSteamInitialReleaseDateReviewRevision(input, { now: () => new Date('2026-08-27T13:00:00.000Z') })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.revisionHash, second.revisionHash)
  assert.deepEqual(first.target.display, {
    mode: 'month-year', rangeStart: '2026-10-01', rangeEnd: '2026-10-31',
    upcomingListPlacementDate: '2026-10-31', upcomingListPlacementSemantics: 'last-day-of-visible-range',
  })
  assert.equal(first.timing.comingSoonLeadDays, 90)
  assert.equal(first.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(first.platformStateAuthenticated || first.savedToSteamworks || first.comingSoonChanged || first.releaseButtonPressed || first.released || first.wishlistNotificationsTriggered || first.executionAuthorized, false)
})

test('binds store, build, observed state, exact date, display and decision evidence', () => {
  const base = prepareSteamInitialReleaseDateReviewRevision(input, { now }).revisionHash
  const mutations = [
    { ...input, storeRevisionRef: 'revision:steam-store-page-v8' },
    { ...input, buildRevisionRef: 'revision:owned-build-v5' },
    { ...input, observedReleaseState: { ...input.observedReleaseState, evidenceRefs: [...input.observedReleaseState.evidenceRefs, 'evidence:new-observation'] } },
    { ...input, target: { ...input.target, specifiedReleaseDate: '2026-11-06' } },
    { ...input, target: { ...input.target, playerFacingDisplay: 'quarter' } },
    { ...input, target: { ...input.target, decisionEvidenceRefs: ['decision:launch-plan-v4'] } },
  ]
  for (const mutation of mutations) assert.notEqual(prepareSteamInitialReleaseDateReviewRevision(mutation, { now }).revisionHash, base)
})

test('derives every official player-facing display without inventing localized copy', () => {
  const expected = {
    'exact-date': ['2026-10-30', '2026-10-30', '2026-10-30', 'exact-date'],
    'month-year': ['2026-10-01', '2026-10-31', '2026-10-31', 'last-day-of-visible-range'],
    quarter: ['2026-10-01', '2026-12-31', '2026-12-31', 'last-day-of-visible-range'],
    year: ['2026-01-01', '2026-12-31', '2026-12-31', 'last-day-of-visible-range'],
    'coming-soon': [null, null, null, 'behind-dated-displays'],
  }
  for (const [mode, values] of Object.entries(expected)) {
    const result = prepareSteamInitialReleaseDateReviewRevision({ ...input, target: { ...input.target, playerFacingDisplay: mode } }, { now })
    assert.deepEqual([result.target.display.rangeStart, result.target.display.rangeEnd, result.target.display.upcomingListPlacementDate, result.target.display.upcomingListPlacementSemantics], values)
  }
})

test('blocks stale or impossible state, missing readiness, short Coming Soon and locked date changes', () => {
  const cases = [
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, releaseState: 'released' } }, 'already-released'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, observedAt: '2026-08-25T08:00:00.000Z' } }, 'observed-state-stale'],
    [{ ...input, target: { ...input.target, specifiedReleaseDate: '2026-08-27' } }, 'target-date-not-future'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, comingSoonPublishedDate: null } }, 'coming-soon-not-published'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, comingSoonPublishedDate: '2026-10-20' } }, 'coming-soon-date-in-future'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, comingSoonPublishedDate: '2026-10-20' }, target: { ...input.target, specifiedReleaseDate: '2026-10-30' } }, 'coming-soon-minimum-not-met'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, storePresenceReviewState: 'in-review' } }, 'store-presence-not-ready'],
    [{ ...input, observedReleaseState: { ...input.observedReleaseState, buildReviewState: 'changes-requested' } }, 'build-not-ready'],
  ]
  for (const [fixture, code] of cases) assert.equal(prepareSteamInitialReleaseDateReviewRevision(fixture, { now }).preflight.blockers.some((item) => item.code === code), true, code)
  const locked = {
    ...input,
    observedReleaseState: { ...input.observedReleaseState, observedAt: '2026-10-20T08:00:00.000Z', specifiedReleaseDate: '2026-10-30' },
    target: { ...input.target, specifiedReleaseDate: '2026-11-15' },
  }
  assert.equal(prepareSteamInitialReleaseDateReviewRevision(locked, { now: () => new Date('2026-10-20T12:00:00.000Z') }).preflight.blockers.some((item) => item.code === 'specified-date-change-locked'), true)
})

test('rejects hidden authority, unsafe refs, duplicate evidence and invalid dates', () => {
  assert.throws(() => prepareSteamInitialReleaseDateReviewRevision({ ...input, publish: true }, { now }), /unsupported fields/)
  assert.throws(() => prepareSteamInitialReleaseDateReviewRevision({ ...input, observedReleaseState: { ...input.observedReleaseState, appId: 123 } }, { now }), /unsupported fields/)
  assert.throws(() => prepareSteamInitialReleaseDateReviewRevision({ ...input, gameRef: '../game' }, { now }), /opaque and bounded/)
  assert.throws(() => prepareSteamInitialReleaseDateReviewRevision({ ...input, observedReleaseState: { ...input.observedReleaseState, evidenceRefs: ['evidence:a', 'evidence:a'] } }, { now }), /unique/)
  assert.throws(() => prepareSteamInitialReleaseDateReviewRevision({ ...input, target: { ...input.target, specifiedReleaseDate: '2026-02-30' } }, { now }), /real ISO calendar date/)
})

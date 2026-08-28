import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareProactiveContactReviewRevision } from '../src/index.mjs'

const input = {
  ownerScopeRef: 'owner:primary',
  policy: {
    optedIn: true,
    pausedUntil: null,
    timeZone: 'Asia/Shanghai',
    quietWindows: [{ start: '22:00', end: '08:00' }],
    minimumGapMinutes: 90,
    maximumPerDay: 3,
    maximumConsecutiveUnanswered: 2,
    recentActivitySuppressionMinutes: 60,
    dedupeWindowMinutes: 120,
  },
  state: {
    evaluatedAt: '2026-08-27T06:00:00Z',
    sentToday: 1,
    consecutiveUnanswered: 0,
    lastProactiveContactAt: '2026-08-27T03:00:00Z',
    lastUserActivityAt: '2026-08-27T04:00:00Z',
    recentDedupeObservations: [],
  },
  candidate: {
    candidateRef: 'proposal:feedback-follow-up-1',
    kind: 'follow-up',
    dedupeKey: 'feedback-follow-up:revision-1',
    basis: 'The user explicitly asked to revisit the feedback synthesis today.',
    evidenceRefs: ['request:fixture-1'],
    consequenceRefs: ['contract:proactive-contact-review-only'],
    surfaceRefs: ['surface:current-desktop'],
    availableFrom: '2026-08-27T05:00:00Z',
    expiresAt: '2026-08-27T10:00:00Z',
    visibleInSourceNow: false,
    copy: { title: 'Feedback follow-up', body: 'The feedback synthesis is ready to review when you have a moment.' },
  },
}

test('prepares a deterministic review-only proactive contact revision', () => {
  const first = prepareProactiveContactReviewRevision(input, { now: () => new Date('2026-08-27T06:01:00Z') })
  const replay = prepareProactiveContactReviewRevision({ ...input, candidate: { ...input.candidate, evidenceRefs: [...input.candidate.evidenceRefs] } }, { now: () => new Date('2026-08-28T06:01:00Z') })
  assert.equal(first.status, 'eligible-for-human-review')
  assert.equal(first.reviewRevisionHash, replay.reviewRevisionHash)
  assert.deepEqual(first.suppressionReasons, [])
  assert.equal(first.reviewItems.length, 7)
  assert.equal(first.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(first.reviewerDecision, null)
  assert.equal(first.notificationSent, false)
  assert.equal(first.messageCreated, false)
  assert.equal(first.deliveryAttempted, false)
  assert.equal(first.executionAuthorized, false)
})

test('binds copy, timing, surfaces, policy and state into the review hash', () => {
  const base = prepareProactiveContactReviewRevision(input)
  const variants = [
    { ...input, candidate: { ...input.candidate, copy: { ...input.candidate.copy, body: `${input.candidate.copy.body} Later is fine.` } } },
    { ...input, candidate: { ...input.candidate, surfaceRefs: ['surface:mobile'] } },
    { ...input, policy: { ...input.policy, maximumPerDay: 4 } },
    { ...input, state: { ...input.state, evaluatedAt: '2026-08-27T06:05:00Z' } },
  ]
  for (const variant of variants) assert.notEqual(prepareProactiveContactReviewRevision(variant).reviewRevisionHash, base.reviewRevisionHash)
})

test('suppresses inside wraparound quiet hours and never produces a review hash', () => {
  const result = prepareProactiveContactReviewRevision({ ...input, state: { ...input.state, evaluatedAt: '2026-08-27T15:30:00Z', lastProactiveContactAt: '2026-08-27T10:00:00Z', lastUserActivityAt: '2026-08-27T10:00:00Z' }, candidate: { ...input.candidate, expiresAt: '2026-08-28T10:00:00Z' } })
  assert.equal(result.status, 'suppressed')
  assert.equal(result.suppressionReasons.includes('quiet-hours'), true)
  assert.equal(result.reviewRevisionHash, null)
  assert.deepEqual(result.reviewItems, [])
})

test('preserves every deterministic suppression instead of letting urgency override policy', () => {
  const result = prepareProactiveContactReviewRevision({
    ...input,
    policy: { ...input.policy, optedIn: false, pausedUntil: '2026-08-27T09:00:00Z', maximumPerDay: 1 },
    state: { ...input.state, sentToday: 1, consecutiveUnanswered: 2, lastProactiveContactAt: '2026-08-27T05:45:00Z', lastUserActivityAt: '2026-08-27T05:50:00Z', recentDedupeObservations: [{ key: input.candidate.dedupeKey, observedAt: '2026-08-27T05:30:00Z' }] },
    candidate: { ...input.candidate, visibleInSourceNow: true },
  })
  assert.equal(result.status, 'suppressed')
  assert.deepEqual(result.suppressionReasons, ['not-opted-in', 'paused', 'visible-in-source', 'recent-user-activity', 'minimum-gap', 'daily-cap', 'unanswered-cap', 'duplicate-recent-contact'])
  assert.equal(result.notificationSent, false)
})

test('blocks an expired candidate and rejects hidden authority or malformed policy state', () => {
  const expired = prepareProactiveContactReviewRevision({ ...input, candidate: { ...input.candidate, expiresAt: '2026-08-27T06:00:00Z' } })
  assert.equal(expired.status, 'blocked')
  assert.deepEqual(expired.preflight.blockers, [{ code: 'candidate-expired' }])
  assert.throws(() => prepareProactiveContactReviewRevision({ ...input, confirmed: true }), /unsupported fields/)
  assert.throws(() => prepareProactiveContactReviewRevision({ ...input, policy: { ...input.policy, timeZone: 'Moon/Base' } }), /IANA time zone/)
  assert.throws(() => prepareProactiveContactReviewRevision({ ...input, policy: { ...input.policy, quietWindows: [{ start: '22:00', end: '22:00' }] } }), /distinct HH:MM/)
  assert.throws(() => prepareProactiveContactReviewRevision({ ...input, state: { ...input.state, lastUserActivityAt: '2026-08-27T07:00:00Z' } }), /must not be after/)
})

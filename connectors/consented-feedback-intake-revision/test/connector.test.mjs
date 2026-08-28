import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareConsentedFeedbackIntakeRevision } from '../src/index.mjs'

const input = {
  scope: {
    scopeRevisionRef: 'feedback-scope:pet-onboarding-v3',
    productRef: 'product:pet-assistant',
    productRevisionRef: 'product-revision:0.2.0',
    decisionRef: 'decision:improve-first-day-activation',
    purposeRefs: ['purpose:product-improvement'],
    expectedFieldRefs: ['difficulty', 'workaround'],
    noticeRevisionRef: 'privacy-notice:feedback-v2',
  },
  submission: {
    submissionRef: 'submission:01J7PETFEEDBACK',
    channel: 'product-form',
    submittedAt: '2026-08-27T08:00:00Z',
    purposeRefs: ['purpose:product-improvement'],
    answers: [
      { fieldRef: 'workaround', kind: 'workaround', statement: 'I reopen the conversation before asking the pet to continue.' },
      { fieldRef: 'difficulty', kind: 'problem', statement: 'The pet loses the current task after I switch sessions.' },
    ],
  },
  consent: {
    status: 'given',
    noticeRevisionRef: 'privacy-notice:feedback-v2',
    evidenceRef: 'consent-receipt:01J7PETFEEDBACK',
    capturedAt: '2026-08-27T07:59:58Z',
    validUntil: '2027-08-27T08:00:00Z',
    withdrawalMechanismRef: 'feedback-withdrawal:self-service-v1',
    otherPeopleData: 'absent',
  },
  privacyReview: {
    status: 'passed',
    directIdentifiers: 'removed',
    sensitiveData: 'absent',
    reidentificationProhibited: true,
    evidenceRefs: ['privacy-review:01J7PETFEEDBACK'],
  },
  retention: { policyRef: 'retention:product-feedback-180d', deleteAfter: '2027-02-23T08:00:00Z' },
  preparedAt: '2026-08-27T08:01:00Z',
  evidenceRefs: ['form-revision:pet-onboarding-v3', 'consent-receipt:01J7PETFEEDBACK'],
}

test('freezes exact consented reviewed feedback without storage authority', () => {
  const first = prepareConsentedFeedbackIntakeRevision(input)
  const replay = prepareConsentedFeedbackIntakeRevision({ ...input, submission: { ...input.submission, answers: [...input.submission.answers].reverse() }, evidenceRefs: [...input.evidenceRefs].reverse() })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.intakeRevisionHash, replay.intakeRevisionHash)
  assert.equal(first.submission.answers[0].fieldRef, 'difficulty')
  assert.match(first.submission.answers[0].contentDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(first.humanReviewRequired, true)
  assert.equal(first.reviewerDecision, null)
  assert.equal(first.stored, false)
  assert.equal(first.receiptIssued, false)
  assert.equal(first.withdrawalApplied, false)
  assert.equal(first.replySent, false)
  assert.equal(first.knowledgeWritten, false)
  assert.equal(first.executionAuthorized, false)
})

test('binds statement, purpose, notice, retention and withdrawal to the revision', () => {
  const base = prepareConsentedFeedbackIntakeRevision(input)
  const variants = [
    { ...input, submission: { ...input.submission, answers: input.submission.answers.map((item) => item.fieldRef === 'difficulty' ? { ...item, statement: `${item.statement} Again.` } : item) } },
    { ...input, scope: { ...input.scope, decisionRef: 'decision:improve-retention' } },
    { ...input, consent: { ...input.consent, withdrawalMechanismRef: 'feedback-withdrawal:email-v1' } },
    { ...input, retention: { ...input.retention, deleteAfter: '2027-02-22T08:00:00Z' } },
  ]
  for (const variant of variants) assert.notEqual(prepareConsentedFeedbackIntakeRevision(variant).intakeRevisionHash, base.intakeRevisionHash)
})

test('blocks invalid consent, purpose and exact form revision', () => {
  const result = prepareConsentedFeedbackIntakeRevision({
    ...input,
    submission: { ...input.submission, purposeRefs: ['purpose:marketing'], answers: input.submission.answers.filter((item) => item.fieldRef !== 'workaround') },
    consent: { ...input.consent, status: 'withdrawn', noticeRevisionRef: 'privacy-notice:old', capturedAt: '2026-08-27T08:00:01Z', validUntil: '2026-08-27T08:00:30Z', otherPeopleData: 'unknown' },
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.intakeRevisionHash, null)
  const codes = result.preflight.blockers.map((item) => item.code)
  for (const code of ['consent-not-current', 'consent-notice-mismatch', 'consent-captured-after-submission', 'consent-expired', 'other-people-data-unresolved', 'purpose-outside-scope', 'expected-answer-missing']) assert.equal(codes.includes(code), true)
})

test('blocks unresolved privacy and overlong or expired retention', () => {
  const unresolved = prepareConsentedFeedbackIntakeRevision({
    ...input,
    privacyReview: { ...input.privacyReview, status: 'requires-review', directIdentifiers: 'present', sensitiveData: 'unknown', reidentificationProhibited: false },
    retention: { ...input.retention, deleteAfter: '2028-08-27T08:00:00Z' },
  })
  const codes = unresolved.preflight.blockers.map((item) => item.code)
  for (const code of ['privacy-review-incomplete', 'direct-identifiers-unresolved', 'sensitive-data-unresolved', 'reidentification-not-prohibited', 'retention-exceeds-policy']) assert.equal(codes.includes(code), true)

  const expired = prepareConsentedFeedbackIntakeRevision({ ...input, retention: { ...input.retention, deleteAfter: '2026-08-27T08:00:30Z' } })
  assert.equal(expired.preflight.blockers.some((item) => item.code === 'retention-expired'), true)
})

test('rejects hidden identity fields, duplicates and impossible preparation time', () => {
  assert.throws(() => prepareConsentedFeedbackIntakeRevision({ ...input, email: 'not-allowed@example.invalid' }), /unsupported fields/)
  assert.throws(() => prepareConsentedFeedbackIntakeRevision({ ...input, submission: { ...input.submission, answers: [...input.submission.answers, input.submission.answers[0]] } }), /fieldRef values must be unique/)
  assert.throws(() => prepareConsentedFeedbackIntakeRevision({ ...input, preparedAt: '2026-08-27T07:59:00Z' }), /must not precede/)
  assert.throws(() => prepareConsentedFeedbackIntakeRevision(input, { maximumRetentionDays: 0 }), /between 1 and 730/)
})

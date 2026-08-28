import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['scope', 'submission', 'consent', 'privacyReview', 'retention', 'preparedAt', 'evidenceRefs'])
const SCOPE_KEYS = new Set(['scopeRevisionRef', 'productRef', 'productRevisionRef', 'decisionRef', 'purposeRefs', 'expectedFieldRefs', 'noticeRevisionRef'])
const SUBMISSION_KEYS = new Set(['submissionRef', 'channel', 'submittedAt', 'purposeRefs', 'answers'])
const ANSWER_KEYS = new Set(['fieldRef', 'kind', 'statement'])
const CONSENT_KEYS = new Set(['status', 'noticeRevisionRef', 'evidenceRef', 'capturedAt', 'validUntil', 'withdrawalMechanismRef', 'otherPeopleData'])
const PRIVACY_KEYS = new Set(['status', 'directIdentifiers', 'sensitiveData', 'reidentificationProhibited', 'evidenceRefs'])
const RETENTION_KEYS = new Set(['policyRef', 'deleteAfter'])
const CHANNELS = new Set(['product-form', 'support-form', 'interview', 'user-study'])
const KINDS = new Set(['problem', 'request', 'workaround', 'praise', 'context', 'counterexample'])
const CONSENT_STATUSES = new Set(['given', 'withdrawn', 'expired', 'unknown'])
const REVIEW_STATUSES = new Set(['passed', 'requires-review', 'not-performed'])
const DATA_STATES = new Set(['absent', 'removed', 'present', 'unknown'])
const OTHER_PEOPLE_STATES = new Set(['absent', 'present', 'unknown'])
const FIELD_REF = /^[a-z][a-z0-9._-]{0,127}$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`

function assertRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function opaque(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function fieldRef(value, name) {
  if (typeof value !== 'string' || !FIELD_REF.test(value)) throw new Error(`${name} must be a stable field reference`)
  return value
}

function date(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be RFC 3339`)
  return new Date(value).toISOString()
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 1200) throw new Error(`${name} must be a non-empty reviewed statement up to 1200 characters`)
  return value.trim()
}

function uniqueSorted(values, name, normalize, { minimum = 1, maximum = 50 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} items`)
  const result = values.map((value, index) => normalize(value, `${name}[${index}]`))
  if (new Set(result).size !== result.length) throw new Error(`${name} must be unique`)
  return result.sort()
}

function normalizeScope(scope) {
  assertRecord(scope, 'scope')
  assertExactKeys(scope, SCOPE_KEYS, 'scope')
  return {
    scopeRevisionRef: opaque(scope.scopeRevisionRef, 'scope.scopeRevisionRef'),
    productRef: opaque(scope.productRef, 'scope.productRef'),
    productRevisionRef: opaque(scope.productRevisionRef, 'scope.productRevisionRef'),
    decisionRef: opaque(scope.decisionRef, 'scope.decisionRef'),
    purposeRefs: uniqueSorted(scope.purposeRefs, 'scope.purposeRefs', opaque, { maximum: 10 }),
    expectedFieldRefs: uniqueSorted(scope.expectedFieldRefs, 'scope.expectedFieldRefs', fieldRef),
    noticeRevisionRef: opaque(scope.noticeRevisionRef, 'scope.noticeRevisionRef'),
  }
}

function normalizeSubmission(submission) {
  assertRecord(submission, 'submission')
  assertExactKeys(submission, SUBMISSION_KEYS, 'submission')
  if (!CHANNELS.has(submission.channel)) throw new Error('submission.channel is unsupported')
  if (!Array.isArray(submission.answers) || submission.answers.length < 1 || submission.answers.length > 50) throw new Error('submission.answers must contain 1..50 items')
  const answers = submission.answers.map((answer, index) => {
    assertRecord(answer, `submission.answers[${index}]`)
    assertExactKeys(answer, ANSWER_KEYS, `submission.answers[${index}]`)
    if (!KINDS.has(answer.kind)) throw new Error(`submission.answers[${index}].kind is unsupported`)
    const normalizedStatement = text(answer.statement, `submission.answers[${index}].statement`)
    return {
      fieldRef: fieldRef(answer.fieldRef, `submission.answers[${index}].fieldRef`),
      kind: answer.kind,
      statement: normalizedStatement,
      contentDigest: digest({ kind: answer.kind, statement: normalizedStatement }),
    }
  }).sort((left, right) => left.fieldRef.localeCompare(right.fieldRef))
  if (new Set(answers.map((answer) => answer.fieldRef)).size !== answers.length) throw new Error('submission answer fieldRef values must be unique')
  return {
    submissionRef: opaque(submission.submissionRef, 'submission.submissionRef'),
    channel: submission.channel,
    submittedAt: date(submission.submittedAt, 'submission.submittedAt'),
    purposeRefs: uniqueSorted(submission.purposeRefs, 'submission.purposeRefs', opaque, { maximum: 10 }),
    answers,
  }
}

function normalizeConsent(consent) {
  assertRecord(consent, 'consent')
  assertExactKeys(consent, CONSENT_KEYS, 'consent')
  if (!CONSENT_STATUSES.has(consent.status)) throw new Error('consent.status is unsupported')
  if (!OTHER_PEOPLE_STATES.has(consent.otherPeopleData)) throw new Error('consent.otherPeopleData is unsupported')
  return {
    status: consent.status,
    noticeRevisionRef: opaque(consent.noticeRevisionRef, 'consent.noticeRevisionRef'),
    evidenceRef: opaque(consent.evidenceRef, 'consent.evidenceRef'),
    capturedAt: date(consent.capturedAt, 'consent.capturedAt'),
    validUntil: date(consent.validUntil, 'consent.validUntil'),
    withdrawalMechanismRef: opaque(consent.withdrawalMechanismRef, 'consent.withdrawalMechanismRef'),
    otherPeopleData: consent.otherPeopleData,
  }
}

function normalizePrivacyReview(review) {
  assertRecord(review, 'privacyReview')
  assertExactKeys(review, PRIVACY_KEYS, 'privacyReview')
  if (!REVIEW_STATUSES.has(review.status)) throw new Error('privacyReview.status is unsupported')
  if (!DATA_STATES.has(review.directIdentifiers)) throw new Error('privacyReview.directIdentifiers is unsupported')
  if (!DATA_STATES.has(review.sensitiveData)) throw new Error('privacyReview.sensitiveData is unsupported')
  if (typeof review.reidentificationProhibited !== 'boolean') throw new Error('privacyReview.reidentificationProhibited must be boolean')
  return {
    status: review.status,
    directIdentifiers: review.directIdentifiers,
    sensitiveData: review.sensitiveData,
    reidentificationProhibited: review.reidentificationProhibited,
    evidenceRefs: uniqueSorted(review.evidenceRefs, 'privacyReview.evidenceRefs', opaque, { maximum: 20 }),
  }
}

function normalizeRetention(retention) {
  assertRecord(retention, 'retention')
  assertExactKeys(retention, RETENTION_KEYS, 'retention')
  return { policyRef: opaque(retention.policyRef, 'retention.policyRef'), deleteAfter: date(retention.deleteAfter, 'retention.deleteAfter') }
}

export function normalizeConsentedFeedbackIntakeInput(input) {
  assertRecord(input, 'input')
  assertExactKeys(input, INPUT_KEYS, 'input')
  const scope = normalizeScope(input.scope)
  const submission = normalizeSubmission(input.submission)
  const consent = normalizeConsent(input.consent)
  const privacyReview = normalizePrivacyReview(input.privacyReview)
  const retention = normalizeRetention(input.retention)
  const preparedAt = date(input.preparedAt, 'preparedAt')
  if (Date.parse(preparedAt) < Date.parse(submission.submittedAt)) throw new Error('preparedAt must not precede submission.submittedAt')
  return {
    scope,
    submission,
    consent,
    privacyReview,
    retention,
    preparedAt,
    evidenceRefs: uniqueSorted(input.evidenceRefs, 'evidenceRefs', opaque, { maximum: 20 }),
  }
}

function blockersFor(input, maximumRetentionDays) {
  const blockers = []
  const refs = (values) => [...new Set(values)].sort()
  if (input.consent.status !== 'given') blockers.push({ code: 'consent-not-current', refs: [input.consent.evidenceRef] })
  if (input.consent.noticeRevisionRef !== input.scope.noticeRevisionRef) blockers.push({ code: 'consent-notice-mismatch', refs: refs([input.consent.noticeRevisionRef, input.scope.noticeRevisionRef]) })
  if (Date.parse(input.consent.capturedAt) > Date.parse(input.submission.submittedAt)) blockers.push({ code: 'consent-captured-after-submission', refs: [input.consent.evidenceRef] })
  if (Date.parse(input.consent.validUntil) <= Date.parse(input.preparedAt)) blockers.push({ code: 'consent-expired', refs: [input.consent.evidenceRef] })
  if (input.consent.otherPeopleData !== 'absent') blockers.push({ code: 'other-people-data-unresolved', refs: [input.submission.submissionRef] })
  const allowedPurposes = new Set(input.scope.purposeRefs)
  const outsidePurposeRefs = input.submission.purposeRefs.filter((ref) => !allowedPurposes.has(ref))
  if (outsidePurposeRefs.length > 0) blockers.push({ code: 'purpose-outside-scope', refs: outsidePurposeRefs })
  const expectedFields = new Set(input.scope.expectedFieldRefs)
  const answerFields = new Set(input.submission.answers.map((answer) => answer.fieldRef))
  const missingFields = input.scope.expectedFieldRefs.filter((ref) => !answerFields.has(ref))
  const unexpectedFields = [...answerFields].filter((ref) => !expectedFields.has(ref)).sort()
  if (missingFields.length > 0) blockers.push({ code: 'expected-answer-missing', refs: missingFields })
  if (unexpectedFields.length > 0) blockers.push({ code: 'unexpected-answer', refs: unexpectedFields })
  if (input.privacyReview.status !== 'passed') blockers.push({ code: 'privacy-review-incomplete', refs: input.privacyReview.evidenceRefs })
  if (!['absent', 'removed'].includes(input.privacyReview.directIdentifiers)) blockers.push({ code: 'direct-identifiers-unresolved', refs: input.privacyReview.evidenceRefs })
  if (!['absent', 'removed'].includes(input.privacyReview.sensitiveData)) blockers.push({ code: 'sensitive-data-unresolved', refs: input.privacyReview.evidenceRefs })
  if (!input.privacyReview.reidentificationProhibited) blockers.push({ code: 'reidentification-not-prohibited', refs: input.privacyReview.evidenceRefs })
  if (Date.parse(input.retention.deleteAfter) <= Date.parse(input.preparedAt)) blockers.push({ code: 'retention-expired', refs: [input.retention.policyRef] })
  const maximumDeleteAfter = Date.parse(input.submission.submittedAt) + maximumRetentionDays * 24 * 60 * 60 * 1000
  if (Date.parse(input.retention.deleteAfter) > maximumDeleteAfter) blockers.push({ code: 'retention-exceeds-policy', refs: [input.retention.policyRef] })
  return blockers
}

export function prepareConsentedFeedbackIntakeRevision(input, { maximumRetentionDays = 365 } = {}) {
  if (!Number.isSafeInteger(maximumRetentionDays) || maximumRetentionDays < 1 || maximumRetentionDays > 730) throw new Error('maximumRetentionDays must be between 1 and 730')
  const normalized = normalizeConsentedFeedbackIntakeInput(input)
  const blockers = blockersFor(normalized, maximumRetentionDays)
  const base = {
    schemaVersion: 'dsh.consented-feedback-intake-review-revision/v1',
    scope: normalized.scope,
    submission: normalized.submission,
    consent: normalized.consent,
    privacyReview: normalized.privacyReview,
    retention: normalized.retention,
    preparedAt: normalized.preparedAt,
    evidenceRefs: normalized.evidenceRefs,
    reviewItems: [
      { id: 'exact-submission-and-fields', status: 'pending' },
      { id: 'purpose-and-notice', status: 'pending' },
      { id: 'consent-validity-and-third-party-data', status: 'pending' },
      { id: 'deidentification-and-sensitive-data', status: 'pending' },
      { id: 'retention-and-withdrawal', status: 'pending' },
    ],
    humanReviewRequired: true,
    reviewerDecision: null,
    stored: false,
    receiptIssued: false,
    withdrawalApplied: false,
    replySent: false,
    knowledgeWritten: false,
    executionAuthorized: false,
  }
  if (blockers.length > 0) return { ...base, status: 'blocked', intakeRevisionHash: null, preflight: { blockers } }
  const revisionPayload = {
    schemaVersion: base.schemaVersion,
    scope: base.scope,
    submission: base.submission,
    consent: base.consent,
    privacyReview: base.privacyReview,
    retention: base.retention,
    preparedAt: base.preparedAt,
    evidenceRefs: base.evidenceRefs,
    reviewItems: base.reviewItems,
  }
  return { ...base, status: 'ready-for-human-review', intakeRevisionHash: digest(revisionPayload), preflight: { blockers: [] } }
}

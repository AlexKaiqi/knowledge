import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['ownerScopeRef', 'policy', 'state', 'candidate'])
const POLICY_KEYS = new Set(['optedIn', 'pausedUntil', 'timeZone', 'quietWindows', 'minimumGapMinutes', 'maximumPerDay', 'maximumConsecutiveUnanswered', 'recentActivitySuppressionMinutes', 'dedupeWindowMinutes'])
const STATE_KEYS = new Set(['evaluatedAt', 'sentToday', 'consecutiveUnanswered', 'lastProactiveContactAt', 'lastUserActivityAt', 'recentDedupeObservations'])
const CANDIDATE_KEYS = new Set(['candidateRef', 'kind', 'dedupeKey', 'basis', 'evidenceRefs', 'consequenceRefs', 'surfaceRefs', 'availableFrom', 'expiresAt', 'visibleInSourceNow', 'copy'])
const COPY_KEYS = new Set(['title', 'body'])
const WINDOW_KEYS = new Set(['start', 'end'])
const DEDUPE_KEYS = new Set(['key', 'observedAt'])
const KINDS = new Set(['reminder', 'follow-up', 'check-in', 'briefing', 'status-update'])
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DEDUPE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function assertObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !keys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function assertRef(value, name, maximum = 500) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maximum) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeRefs(values, name, { minimum = 1, maximum = 20 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} references`)
  const normalized = values.map((value, index) => assertRef(value, `${name}[${index}]`))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
  return normalized.sort()
}

function normalizeDate(value, name, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be an RFC 3339 date-time`)
  return new Date(value).toISOString()
}

function normalizeInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  return value
}

function normalizeText(value, name, maximum) {
  if (typeof value !== 'string' || value.trim().length < 1 || [...value].length > maximum) throw new Error(`${name} must contain 1..${maximum} code points`)
  if (value !== value.normalize('NFC')) throw new Error(`${name} must be NFC-normalized`)
  if (CONTROL_CHARACTERS.test(value)) throw new Error(`${name} contains unsupported control characters`)
  return value.trim()
}

function validTimeZone(value) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format() } catch { return false }
  return true
}

export function normalizeProactiveContactReviewInput(input) {
  assertObject(input, 'input', INPUT_KEYS)
  assertObject(input.policy, 'policy', POLICY_KEYS)
  assertObject(input.state, 'state', STATE_KEYS)
  assertObject(input.candidate, 'candidate', CANDIDATE_KEYS)
  assertObject(input.candidate.copy, 'candidate.copy', COPY_KEYS)
  if (typeof input.policy.optedIn !== 'boolean') throw new Error('policy.optedIn must be boolean')
  const timeZone = assertRef(input.policy.timeZone, 'policy.timeZone', 100)
  if (!validTimeZone(timeZone)) throw new Error('policy.timeZone must be a supported IANA time zone')
  if (!Array.isArray(input.policy.quietWindows) || input.policy.quietWindows.length > 4) throw new Error('policy.quietWindows must contain 0..4 windows')
  const quietWindows = input.policy.quietWindows.map((window, index) => {
    assertObject(window, `policy.quietWindows[${index}]`, WINDOW_KEYS)
    if (!CLOCK.test(window.start) || !CLOCK.test(window.end) || window.start === window.end) throw new Error(`policy.quietWindows[${index}] must contain distinct HH:MM bounds`)
    return { start: window.start, end: window.end }
  }).sort((left, right) => `${left.start}-${left.end}`.localeCompare(`${right.start}-${right.end}`))
  if (new Set(quietWindows.map((window) => `${window.start}-${window.end}`)).size !== quietWindows.length) throw new Error('policy.quietWindows must be unique')
  const evaluatedAt = normalizeDate(input.state.evaluatedAt, 'state.evaluatedAt')
  const lastProactiveContactAt = normalizeDate(input.state.lastProactiveContactAt, 'state.lastProactiveContactAt', true)
  const lastUserActivityAt = normalizeDate(input.state.lastUserActivityAt, 'state.lastUserActivityAt', true)
  for (const [name, value] of Object.entries({ lastProactiveContactAt, lastUserActivityAt })) if (value !== null && Date.parse(value) > Date.parse(evaluatedAt)) throw new Error(`state.${name} must not be after evaluatedAt`)
  if (!Array.isArray(input.state.recentDedupeObservations) || input.state.recentDedupeObservations.length > 100) throw new Error('state.recentDedupeObservations must contain 0..100 items')
  const recentDedupeObservations = input.state.recentDedupeObservations.map((item, index) => {
    assertObject(item, `state.recentDedupeObservations[${index}]`, DEDUPE_KEYS)
    if (typeof item.key !== 'string' || !DEDUPE_KEY.test(item.key)) throw new Error(`state.recentDedupeObservations[${index}].key is invalid`)
    const observedAt = normalizeDate(item.observedAt, `state.recentDedupeObservations[${index}].observedAt`)
    if (Date.parse(observedAt) > Date.parse(evaluatedAt)) throw new Error(`state.recentDedupeObservations[${index}].observedAt must not be after evaluatedAt`)
    return { key: item.key, observedAt }
  }).sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.key.localeCompare(right.key))
  if (new Set(recentDedupeObservations.map((item) => `${item.key}\0${item.observedAt}`)).size !== recentDedupeObservations.length) throw new Error('state.recentDedupeObservations must be unique')
  if (!KINDS.has(input.candidate.kind)) throw new Error('candidate.kind is invalid')
  if (typeof input.candidate.dedupeKey !== 'string' || !DEDUPE_KEY.test(input.candidate.dedupeKey)) throw new Error('candidate.dedupeKey is invalid')
  if (typeof input.candidate.visibleInSourceNow !== 'boolean') throw new Error('candidate.visibleInSourceNow must be boolean')
  const availableFrom = normalizeDate(input.candidate.availableFrom, 'candidate.availableFrom')
  const expiresAt = normalizeDate(input.candidate.expiresAt, 'candidate.expiresAt')
  if (Date.parse(availableFrom) >= Date.parse(expiresAt)) throw new Error('candidate.availableFrom must be before expiresAt')
  return {
    ownerScopeRef: assertRef(input.ownerScopeRef, 'ownerScopeRef'),
    policy: {
      optedIn: input.policy.optedIn,
      pausedUntil: normalizeDate(input.policy.pausedUntil, 'policy.pausedUntil', true),
      timeZone,
      quietWindows,
      minimumGapMinutes: normalizeInteger(input.policy.minimumGapMinutes, 'policy.minimumGapMinutes', 1, 1440),
      maximumPerDay: normalizeInteger(input.policy.maximumPerDay, 'policy.maximumPerDay', 1, 20),
      maximumConsecutiveUnanswered: normalizeInteger(input.policy.maximumConsecutiveUnanswered, 'policy.maximumConsecutiveUnanswered', 1, 20),
      recentActivitySuppressionMinutes: normalizeInteger(input.policy.recentActivitySuppressionMinutes, 'policy.recentActivitySuppressionMinutes', 0, 1440),
      dedupeWindowMinutes: normalizeInteger(input.policy.dedupeWindowMinutes, 'policy.dedupeWindowMinutes', 1, 1440),
    },
    state: {
      evaluatedAt,
      sentToday: normalizeInteger(input.state.sentToday, 'state.sentToday', 0, 100),
      consecutiveUnanswered: normalizeInteger(input.state.consecutiveUnanswered, 'state.consecutiveUnanswered', 0, 100),
      lastProactiveContactAt,
      lastUserActivityAt,
      recentDedupeObservations,
    },
    candidate: {
      candidateRef: assertRef(input.candidate.candidateRef, 'candidate.candidateRef'),
      kind: input.candidate.kind,
      dedupeKey: input.candidate.dedupeKey,
      basis: normalizeText(input.candidate.basis, 'candidate.basis', 1000),
      evidenceRefs: normalizeRefs(input.candidate.evidenceRefs, 'candidate.evidenceRefs'),
      consequenceRefs: normalizeRefs(input.candidate.consequenceRefs, 'candidate.consequenceRefs'),
      surfaceRefs: normalizeRefs(input.candidate.surfaceRefs, 'candidate.surfaceRefs', { maximum: 5 }),
      availableFrom,
      expiresAt,
      visibleInSourceNow: input.candidate.visibleInSourceNow,
      copy: {
        title: normalizeText(input.candidate.copy.title, 'candidate.copy.title', 120),
        body: normalizeText(input.candidate.copy.body, 'candidate.copy.body', 500),
      },
    },
  }
}

function localMinutes(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  return hour * 60 + minute
}

const clockMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const inQuietWindow = (minute, window) => {
  const start = clockMinutes(window.start)
  const end = clockMinutes(window.end)
  return start < end ? minute >= start && minute < end : minute >= start || minute < end
}

function reviewItems() {
  return ['basis-and-user-benefit', 'timing-and-interruption', 'copy-and-sensitive-data', 'exact-surfaces-and-audience', 'duplicate-and-current-context', 'snooze-dismiss-and-disable', 'expiry-and-cancel'].map((id) => ({ id, status: 'pending' }))
}

export function prepareProactiveContactReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeProactiveContactReviewInput(input)
  const at = Date.parse(normalized.state.evaluatedAt)
  const suppressions = []
  const blockers = []
  if (at >= Date.parse(normalized.candidate.expiresAt)) blockers.push({ code: 'candidate-expired' })
  if (!normalized.policy.optedIn) suppressions.push('not-opted-in')
  if (normalized.policy.pausedUntil !== null && at < Date.parse(normalized.policy.pausedUntil)) suppressions.push('paused')
  if (normalized.candidate.visibleInSourceNow) suppressions.push('visible-in-source')
  if (at < Date.parse(normalized.candidate.availableFrom)) suppressions.push('not-yet-available')
  if (normalized.state.lastUserActivityAt !== null && at - Date.parse(normalized.state.lastUserActivityAt) < normalized.policy.recentActivitySuppressionMinutes * 60_000) suppressions.push('recent-user-activity')
  if (normalized.state.lastProactiveContactAt !== null && at - Date.parse(normalized.state.lastProactiveContactAt) < normalized.policy.minimumGapMinutes * 60_000) suppressions.push('minimum-gap')
  if (normalized.state.sentToday >= normalized.policy.maximumPerDay) suppressions.push('daily-cap')
  if (normalized.state.consecutiveUnanswered >= normalized.policy.maximumConsecutiveUnanswered) suppressions.push('unanswered-cap')
  if (normalized.policy.quietWindows.some((window) => inQuietWindow(localMinutes(normalized.state.evaluatedAt, normalized.policy.timeZone), window))) suppressions.push('quiet-hours')
  const dedupeCutoff = at - normalized.policy.dedupeWindowMinutes * 60_000
  if (normalized.state.recentDedupeObservations.some((item) => item.key === normalized.candidate.dedupeKey && Date.parse(item.observedAt) >= dedupeCutoff)) suppressions.push('duplicate-recent-contact')
  const status = blockers.length > 0 ? 'blocked' : suppressions.length > 0 ? 'suppressed' : 'eligible-for-human-review'
  const revisionPayload = {
    schemaVersion: 'dsh.proactive-contact-review-revision/v1',
    ownerScopeRef: normalized.ownerScopeRef,
    policy: normalized.policy,
    state: normalized.state,
    candidate: normalized.candidate,
    policySemanticsRevision: 'proactive-contact-policy-2026-08-27',
  }
  return {
    ...revisionPayload,
    status,
    reviewRevisionHash: status === 'eligible-for-human-review' ? digest(stableStringify(revisionPayload)) : null,
    suppressionReasons: suppressions,
    preflight: { blockers },
    reviewItems: status === 'eligible-for-human-review' ? reviewItems() : [],
    reviewerDecision: null,
    notificationSent: false,
    messageCreated: false,
    deliveryAttempted: false,
    executionAuthorized: false,
    preparedAt: now().toISOString(),
  }
}

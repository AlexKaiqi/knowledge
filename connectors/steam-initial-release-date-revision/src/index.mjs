import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'storeRevisionRef', 'buildRevisionRef', 'observedReleaseState', 'target'])
const OBSERVED_KEYS = new Set(['observedAt', 'releaseState', 'specifiedReleaseDate', 'playerFacingDisplay', 'comingSoonPublishedDate', 'storePresenceReviewState', 'buildReviewState', 'evidenceRefs'])
const TARGET_KEYS = new Set(['specifiedReleaseDate', 'playerFacingDisplay', 'decisionEvidenceRefs'])
const DISPLAY_MODES = Object.freeze(['exact-date', 'month-year', 'quarter', 'year', 'coming-soon'])
const REVIEW_STATES = Object.freeze(['not-submitted', 'in-review', 'changes-requested', 'ready-for-release'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY = 24 * 60 * 60 * 1000
const MAX_OBSERVATION_AGE = DAY

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function record(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key))
  if (unsupported.length > 0) throw new Error(`${name} contains unsupported fields: ${unsupported.join(', ')}`)
  return value
}

function ref(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500 || /[\0\r\n]/.test(value)) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function refs(values, name) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) throw new Error(`${name} must contain 1..20 references`)
  const normalized = values.map((value, index) => ref(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} references must be unique`)
  return normalized
}

function oneOf(value, name, allowed) {
  if (!allowed.includes(value)) throw new Error(`${name} is unsupported`)
  return value
}

function date(value, name) {
  if (typeof value !== 'string' || !DATE.test(value)) throw new Error(`${name} must be an ISO calendar date`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${name} must be a real ISO calendar date`)
  return value
}

function instant(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be an ISO instant`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error(`${name} must be a canonical ISO instant`)
  return value
}

const dateMs = (value) => Date.parse(`${value}T00:00:00.000Z`)
const daysBetween = (left, right) => Math.round((dateMs(right) - dateMs(left)) / DAY)

function lastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function deriveDisplay(specifiedReleaseDate, mode) {
  const [year, month] = specifiedReleaseDate.split('-').map(Number)
  if (mode === 'exact-date') return { mode, rangeStart: specifiedReleaseDate, rangeEnd: specifiedReleaseDate, upcomingListPlacementDate: specifiedReleaseDate, upcomingListPlacementSemantics: 'exact-date' }
  if (mode === 'month-year') {
    const rangeStart = `${year}-${String(month).padStart(2, '0')}-01`
    const rangeEnd = lastDay(year, month)
    return { mode, rangeStart, rangeEnd, upcomingListPlacementDate: rangeEnd, upcomingListPlacementSemantics: 'last-day-of-visible-range' }
  }
  if (mode === 'quarter') {
    const firstMonth = Math.floor((month - 1) / 3) * 3 + 1
    const lastMonth = firstMonth + 2
    const rangeStart = `${year}-${String(firstMonth).padStart(2, '0')}-01`
    const rangeEnd = lastDay(year, lastMonth)
    return { mode, rangeStart, rangeEnd, upcomingListPlacementDate: rangeEnd, upcomingListPlacementSemantics: 'last-day-of-visible-range' }
  }
  if (mode === 'year') {
    return { mode, rangeStart: `${year}-01-01`, rangeEnd: `${year}-12-31`, upcomingListPlacementDate: `${year}-12-31`, upcomingListPlacementSemantics: 'last-day-of-visible-range' }
  }
  return { mode, rangeStart: null, rangeEnd: null, upcomingListPlacementDate: null, upcomingListPlacementSemantics: 'behind-dated-displays' }
}

export function normalizeSteamInitialReleaseDateInput(input) {
  record(input, 'input', INPUT_KEYS)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  const observed = record(input.observedReleaseState, 'observedReleaseState', OBSERVED_KEYS)
  const target = record(input.target, 'target', TARGET_KEYS)
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: ref(input.sourceRevisionRef, 'sourceRevisionRef'),
    storeRevisionRef: ref(input.storeRevisionRef, 'storeRevisionRef'),
    buildRevisionRef: ref(input.buildRevisionRef, 'buildRevisionRef'),
    observedReleaseState: {
      observedAt: instant(observed.observedAt, 'observedReleaseState.observedAt'),
      releaseState: oneOf(observed.releaseState, 'observedReleaseState.releaseState', ['not-released', 'released']),
      specifiedReleaseDate: date(observed.specifiedReleaseDate, 'observedReleaseState.specifiedReleaseDate'),
      playerFacingDisplay: oneOf(observed.playerFacingDisplay, 'observedReleaseState.playerFacingDisplay', DISPLAY_MODES),
      comingSoonPublishedDate: observed.comingSoonPublishedDate === null ? null : date(observed.comingSoonPublishedDate, 'observedReleaseState.comingSoonPublishedDate'),
      storePresenceReviewState: oneOf(observed.storePresenceReviewState, 'observedReleaseState.storePresenceReviewState', REVIEW_STATES),
      buildReviewState: oneOf(observed.buildReviewState, 'observedReleaseState.buildReviewState', REVIEW_STATES),
      evidenceRefs: refs(observed.evidenceRefs, 'observedReleaseState.evidenceRefs'),
    },
    target: {
      specifiedReleaseDate: date(target.specifiedReleaseDate, 'target.specifiedReleaseDate'),
      playerFacingDisplay: oneOf(target.playerFacingDisplay, 'target.playerFacingDisplay', DISPLAY_MODES),
      decisionEvidenceRefs: refs(target.decisionEvidenceRefs, 'target.decisionEvidenceRefs'),
    },
  }
}

function manualReview() {
  return { required: true, checks: [
    { id: 'official-release-date-semantics-current', status: 'pending' },
    { id: 'owned-target-and-submitter-authority', status: 'pending' },
    { id: 'publish-app-changes-permission', status: 'pending' },
    { id: 'manage-pricing-and-discounts-permission', status: 'pending' },
    { id: 'store-and-build-review-state-still-current', status: 'pending' },
    { id: 'player-facing-date-specificity-intentional', status: 'pending' },
    { id: 'public-communications-consistent', status: 'pending' },
    { id: 'release-day-support-plan-ready', status: 'pending' },
    { id: 'wishlist-notification-impact-understood', status: 'pending' },
  ] }
}

export function prepareSteamInitialReleaseDateReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamInitialReleaseDateInput(input)
  const prepared = now()
  if (!(prepared instanceof Date) || !Number.isFinite(prepared.getTime())) throw new Error('now must return a valid Date')
  const observed = normalized.observedReleaseState
  const target = normalized.target
  const today = prepared.toISOString().slice(0, 10)
  const observedAt = new Date(observed.observedAt)
  const observationAgeMs = prepared.getTime() - observedAt.getTime()
  const daysUntilTarget = daysBetween(today, target.specifiedReleaseDate)
  const daysUntilCurrent = daysBetween(today, observed.specifiedReleaseDate)
  const comingSoonLeadDays = observed.comingSoonPublishedDate === null ? null : daysBetween(observed.comingSoonPublishedDate, target.specifiedReleaseDate)
  const dateChangeRequested = observed.specifiedReleaseDate !== target.specifiedReleaseDate
  const dateChangeWindow = daysUntilCurrent <= 14 ? 'locked' : 'open'
  const display = deriveDisplay(target.specifiedReleaseDate, target.playerFacingDisplay)
  const blockers = []
  if (observed.releaseState === 'released') blockers.push({ code: 'already-released' })
  if (observationAgeMs < 0) blockers.push({ code: 'observed-state-from-future' })
  else if (observationAgeMs > MAX_OBSERVATION_AGE) blockers.push({ code: 'observed-state-stale' })
  if (daysUntilTarget <= 0) blockers.push({ code: 'target-date-not-future' })
  if (observed.comingSoonPublishedDate === null) blockers.push({ code: 'coming-soon-not-published' })
  else {
    if (daysBetween(today, observed.comingSoonPublishedDate) > 0) blockers.push({ code: 'coming-soon-date-in-future' })
    if (comingSoonLeadDays < 14) blockers.push({ code: 'coming-soon-minimum-not-met' })
  }
  if (observed.storePresenceReviewState !== 'ready-for-release') blockers.push({ code: 'store-presence-not-ready' })
  if (observed.buildReviewState !== 'ready-for-release') blockers.push({ code: 'build-not-ready' })
  if (dateChangeRequested && dateChangeWindow === 'locked') blockers.push({ code: 'specified-date-change-locked' })
  blockers.sort((left, right) => left.code.localeCompare(right.code))
  const checks = [
    { id: 'unreleased-state', status: observed.releaseState === 'not-released' ? 'passed' : 'failed' },
    { id: 'fresh-observed-state', status: observationAgeMs >= 0 && observationAgeMs <= MAX_OBSERVATION_AGE ? 'passed' : 'failed' },
    { id: 'future-specified-date', status: daysUntilTarget > 0 ? 'passed' : 'failed' },
    { id: 'coming-soon-minimum-window', status: observed.comingSoonPublishedDate !== null && daysBetween(today, observed.comingSoonPublishedDate) <= 0 && comingSoonLeadDays >= 14 ? 'passed' : 'failed' },
    { id: 'store-and-build-ready-for-release', status: observed.storePresenceReviewState === 'ready-for-release' && observed.buildReviewState === 'ready-for-release' ? 'passed' : 'failed' },
    { id: 'specified-date-change-window', status: !dateChangeRequested || dateChangeWindow === 'open' ? 'passed' : 'failed' },
  ]
  const policyRevision = 'steam-initial-release-date-2026-08-27'
  const common = {
    schemaVersion: 'dsh.steam-initial-release-date-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    storeRevisionRef: normalized.storeRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    policyRevision,
    observedReleaseState: observed,
    target: { ...target, display },
    timing: {
      observationMaximumAgeHours: 24,
      daysUntilTarget,
      comingSoonLeadDays,
      minimumComingSoonDays: 14,
      minimumComingSoonSatisfied: comingSoonLeadDays !== null && comingSoonLeadDays >= 14,
      dateChangeRequested,
      dateChangeWindow,
    },
    manualReview: manualReview(),
    platformStateAuthenticated: false,
    savedToSteamworks: false,
    comingSoonChanged: false,
    releaseButtonPressed: false,
    released: false,
    wishlistNotificationsTriggered: false,
    executionAuthorized: false,
    preparedAt: prepared.toISOString(),
  }
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, preflight: { checks, blockers } }
  const revisionPayload = {
    schemaVersion: common.schemaVersion,
    gameRef: common.gameRef,
    sourceRevisionRef: common.sourceRevisionRef,
    storeRevisionRef: common.storeRevisionRef,
    buildRevisionRef: common.buildRevisionRef,
    policyRevision,
    observedReleaseState: observed,
    target: common.target,
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digest(stableStringify(revisionPayload)), preflight: { checks, blockers: [] } }
}

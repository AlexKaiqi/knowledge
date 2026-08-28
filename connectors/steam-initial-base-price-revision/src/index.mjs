import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'pricingCatalogRevisionRef', 'minimumThresholdRevisionRef', 'packageRef', 'buildRevisionRef', 'observedPricingState', 'target'])
const OBSERVED_KEYS = new Set(['observedAt', 'releaseState', 'packageState', 'pricingSubmissionState', 'currentPriceScheduleDigest', 'activeOrScheduledDiscount', 'evidenceRefs'])
const TARGET_KEYS = new Set(['packageKind', 'publishMode', 'pricePoints', 'marketResearchEvidenceRefs', 'valueEvidenceRefs'])
const POINT_KEYS = new Set(['marketCode', 'amountMinorUnits', 'observedMinimumBaseMinorUnits'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const DIGEST = /^sha256:[a-f0-9]{64}$/
const DAY = 24 * 60 * 60 * 1000
const MAX_OBSERVATION_AGE = DAY

export const STEAM_INITIAL_PRICE_MARKETS = Object.freeze([
  'AED', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'EUR', 'GBP', 'HKD', 'IDR', 'ILS', 'INR', 'JPY', 'KRW', 'KWD', 'KZT', 'MXN', 'MYR', 'NOK', 'NZD', 'PEN', 'PHP', 'PLN', 'QAR', 'RUB', 'SAR', 'SGD', 'THB', 'TWD', 'UAH', 'USD', 'USD_CIS', 'USD_LATAM', 'USD_MENA', 'USD_SASIA', 'UYU', 'VND', 'ZAR',
])

const MARKET_SET = new Set(STEAM_INITIAL_PRICE_MARKETS)
const INCREMENTS = Object.freeze({ CLP: 100, COP: 100, CRC: 500, IDR: 100, INR: 100, JPY: 100, KRW: 1000, KZT: 100, TWD: 100, UAH: 100, UYU: 100, VND: 50000 })

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

function instant(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be an ISO instant`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error(`${name} must be a canonical ISO instant`)
  return value
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) throw new Error(`${name} must be a positive bounded integer`)
  return value
}

function normalizePricePoints(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > STEAM_INITIAL_PRICE_MARKETS.length + 4) throw new Error('target.pricePoints must be bounded')
  const normalized = values.map((value, index) => {
    const point = record(value, `target.pricePoints[${index}]`, POINT_KEYS)
    if (typeof point.marketCode !== 'string' || !/^[A-Z]{3}(?:_[A-Z]+)?$/.test(point.marketCode)) throw new Error(`target.pricePoints[${index}].marketCode is invalid`)
    return {
      marketCode: point.marketCode,
      amountMinorUnits: positiveInteger(point.amountMinorUnits, `target.pricePoints[${index}].amountMinorUnits`),
      observedMinimumBaseMinorUnits: positiveInteger(point.observedMinimumBaseMinorUnits, `target.pricePoints[${index}].observedMinimumBaseMinorUnits`),
    }
  }).sort((left, right) => left.marketCode.localeCompare(right.marketCode))
  if (new Set(normalized.map((point) => point.marketCode)).size !== normalized.length) throw new Error('target.pricePoints market codes must be unique')
  return normalized
}

export function normalizeSteamInitialBasePriceInput(input) {
  record(input, 'input', INPUT_KEYS)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  const observed = record(input.observedPricingState, 'observedPricingState', OBSERVED_KEYS)
  const target = record(input.target, 'target', TARGET_KEYS)
  if (observed.currentPriceScheduleDigest !== null && (typeof observed.currentPriceScheduleDigest !== 'string' || !DIGEST.test(observed.currentPriceScheduleDigest))) throw new Error('observedPricingState.currentPriceScheduleDigest must be null or a sha256 digest')
  if (typeof observed.activeOrScheduledDiscount !== 'boolean') throw new Error('observedPricingState.activeOrScheduledDiscount must be boolean')
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: ref(input.sourceRevisionRef, 'sourceRevisionRef'),
    pricingCatalogRevisionRef: ref(input.pricingCatalogRevisionRef, 'pricingCatalogRevisionRef'),
    minimumThresholdRevisionRef: ref(input.minimumThresholdRevisionRef, 'minimumThresholdRevisionRef'),
    packageRef: ref(input.packageRef, 'packageRef'),
    buildRevisionRef: ref(input.buildRevisionRef, 'buildRevisionRef'),
    observedPricingState: {
      observedAt: instant(observed.observedAt, 'observedPricingState.observedAt'),
      releaseState: oneOf(observed.releaseState, 'observedPricingState.releaseState', ['unreleased', 'released']),
      packageState: oneOf(observed.packageState, 'observedPricingState.packageState', ['standard-package-present', 'missing']),
      pricingSubmissionState: oneOf(observed.pricingSubmissionState, 'observedPricingState.pricingSubmissionState', ['not-submitted', 'draft', 'under-review', 'approved']),
      currentPriceScheduleDigest: observed.currentPriceScheduleDigest,
      activeOrScheduledDiscount: observed.activeOrScheduledDiscount,
      evidenceRefs: refs(observed.evidenceRefs, 'observedPricingState.evidenceRefs'),
    },
    target: {
      packageKind: oneOf(target.packageKind, 'target.packageKind', ['standard-base-game']),
      publishMode: oneOf(target.publishMode, 'target.publishMode', ['valve-publish-after-review', 'partner-manual-publish-after-review']),
      pricePoints: normalizePricePoints(target.pricePoints),
      marketResearchEvidenceRefs: refs(target.marketResearchEvidenceRefs, 'target.marketResearchEvidenceRefs'),
      valueEvidenceRefs: refs(target.valueEvidenceRefs, 'target.valueEvidenceRefs'),
    },
  }
}

function manualReview() {
  return { required: true, checks: [
    { id: 'official-pricing-currency-and-minimum-semantics-current', status: 'pending' },
    { id: 'owned-package-and-getting-paid-partner-confirmed', status: 'pending' },
    { id: 'manage-pricing-and-discounts-permission-confirmed', status: 'pending' },
    { id: 'authenticated-market-catalog-and-minimums-match', status: 'pending' },
    { id: 'all-regional-price-decisions-intentional', status: 'pending' },
    { id: 'market-research-and-player-value-reviewed', status: 'pending' },
    { id: 'package-state-and-discount-state-still-current', status: 'pending' },
    { id: 'steamworks-preview-decimals-and-outliers-reviewed', status: 'pending' },
    { id: 'valve-review-and-publish-mode-understood', status: 'pending' },
  ] }
}

export function prepareSteamInitialBasePriceReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamInitialBasePriceInput(input)
  const prepared = now()
  if (!(prepared instanceof Date) || !Number.isFinite(prepared.getTime())) throw new Error('now must return a valid Date')
  const observed = normalized.observedPricingState
  const age = prepared.getTime() - Date.parse(observed.observedAt)
  const observedCodes = new Set(normalized.target.pricePoints.map((point) => point.marketCode))
  const missingMarketCodes = STEAM_INITIAL_PRICE_MARKETS.filter((code) => !observedCodes.has(code))
  const unexpectedMarketCodes = [...observedCodes].filter((code) => !MARKET_SET.has(code)).sort()
  const belowMinimumMarketCodes = normalized.target.pricePoints.filter((point) => point.amountMinorUnits < point.observedMinimumBaseMinorUnits).map((point) => point.marketCode)
  const invalidIncrementMarketCodes = normalized.target.pricePoints.filter((point) => {
    const increment = INCREMENTS[point.marketCode] ?? 1
    return point.amountMinorUnits % increment !== 0 || point.observedMinimumBaseMinorUnits % increment !== 0
  }).map((point) => point.marketCode)
  const blockers = []
  if (age < 0) blockers.push({ code: 'observed-state-from-future' })
  else if (age > MAX_OBSERVATION_AGE) blockers.push({ code: 'observed-state-stale' })
  if (observed.releaseState !== 'unreleased') blockers.push({ code: 'already-released' })
  if (observed.packageState !== 'standard-package-present') blockers.push({ code: 'standard-package-missing' })
  if (!['not-submitted', 'draft'].includes(observed.pricingSubmissionState)) blockers.push({ code: 'initial-pricing-already-submitted' })
  if (observed.currentPriceScheduleDigest !== null) blockers.push({ code: 'existing-price-schedule-requires-update-capability' })
  if (observed.activeOrScheduledDiscount) blockers.push({ code: 'discount-state-conflicts-with-base-price-preparation' })
  if (missingMarketCodes.length > 0) blockers.push({ code: 'missing-market-prices', marketCodes: missingMarketCodes })
  if (unexpectedMarketCodes.length > 0) blockers.push({ code: 'unsupported-market-prices', marketCodes: unexpectedMarketCodes })
  if (belowMinimumMarketCodes.length > 0) blockers.push({ code: 'price-below-observed-minimum', marketCodes: belowMinimumMarketCodes })
  if (invalidIncrementMarketCodes.length > 0) blockers.push({ code: 'currency-increment-invalid', marketCodes: invalidIncrementMarketCodes })
  blockers.sort((left, right) => left.code.localeCompare(right.code))
  const checks = [
    { id: 'fresh-observed-state', status: age >= 0 && age <= MAX_OBSERVATION_AGE ? 'passed' : 'failed' },
    { id: 'unreleased-with-standard-package', status: observed.releaseState === 'unreleased' && observed.packageState === 'standard-package-present' ? 'passed' : 'failed' },
    { id: 'initial-pricing-not-submitted', status: ['not-submitted', 'draft'].includes(observed.pricingSubmissionState) && observed.currentPriceScheduleDigest === null ? 'passed' : 'failed' },
    { id: 'no-active-or-scheduled-discount', status: !observed.activeOrScheduledDiscount ? 'passed' : 'failed' },
    { id: 'complete-current-market-set', status: missingMarketCodes.length === 0 && unexpectedMarketCodes.length === 0 ? 'passed' : 'failed' },
    { id: 'observed-minimum-and-currency-increment', status: belowMinimumMarketCodes.length === 0 && invalidIncrementMarketCodes.length === 0 ? 'passed' : 'failed' },
  ]
  const policyRevision = 'steam-initial-base-price-2026-08-27'
  const common = {
    schemaVersion: 'dsh.steam-initial-base-price-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    pricingCatalogRevisionRef: normalized.pricingCatalogRevisionRef,
    minimumThresholdRevisionRef: normalized.minimumThresholdRevisionRef,
    packageRef: normalized.packageRef,
    buildRevisionRef: normalized.buildRevisionRef,
    policyRevision,
    observedPricingState: observed,
    target: normalized.target,
    coverage: {
      liveCurrencyCount: 37,
      usdRegionGroupCount: 4,
      expectedMarketCount: STEAM_INITIAL_PRICE_MARKETS.length,
      suppliedMarketCount: normalized.target.pricePoints.filter((point) => MARKET_SET.has(point.marketCode)).length,
      completeObservedMarketSet: missingMarketCodes.length === 0 && unexpectedMarketCodes.length === 0,
      missingMarketCodes,
      unexpectedMarketCodes,
      minimumThresholdsAuthenticated: false,
      pricingCatalogAuthenticated: false,
      discountsIncluded: false,
      subsequentPriceChangesIncluded: false,
    },
    manualReview: manualReview(),
    platformStateAuthenticated: false,
    priceValidityConfirmed: false,
    csvGenerated: false,
    submittedToValve: false,
    approvedByValve: false,
    publishedToSteam: false,
    discountConfigured: false,
    automaticSchedulingSupported: false,
    executionAuthorized: false,
    preparedAt: prepared.toISOString(),
  }
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, preflight: { checks, blockers } }
  const revisionPayload = {
    schemaVersion: common.schemaVersion,
    gameRef: common.gameRef,
    sourceRevisionRef: common.sourceRevisionRef,
    pricingCatalogRevisionRef: common.pricingCatalogRevisionRef,
    minimumThresholdRevisionRef: common.minimumThresholdRevisionRef,
    packageRef: common.packageRef,
    buildRevisionRef: common.buildRevisionRef,
    policyRevision,
    observedPricingState: observed,
    target: common.target,
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digest(stableStringify(revisionPayload)), preflight: { checks, blockers: [] } }
}

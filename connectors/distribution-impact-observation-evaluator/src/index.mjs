import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['evaluationRef', 'targetRef', 'publication', 'evaluatedAt', 'comparisons'])
const PUBLICATION_KEYS = new Set(['revisionRef', 'receiptRef', 'occurredAt'])
const COMPARISON_KEYS = new Set(['comparisonRef', 'baseline', 'current', 'attribution'])
const OBSERVATION_KEYS = new Set(['sourceRef', 'platform', 'surfaceRef', 'metricRef', 'definitionRef', 'definitionDigest', 'scopeDigest', 'unit', 'windowStart', 'windowEnd', 'state', 'value', 'completeness', 'finalizedAt'])
const ATTRIBUTION_KEYS = new Set(['method', 'evidenceRefs'])
const PLATFORMS = new Set(['steam', 'apple-app-store', 'google-play'])
const STATES = new Set(['observed', 'suppressed', 'unavailable', 'not-finalized'])
const COMPLETENESS = new Set(['complete', 'partial', 'unknown'])
const ATTRIBUTION = new Set(['platform-attributed', 'temporal-only', 'none'])
const DIGEST = /^sha256:[0-9a-f]{64}$/
const REF = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => createHash('sha256').update(stableStringify(value)).digest('hex')

function assertObject(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function ref(value, name) {
  if (typeof value !== 'string' || !REF.test(value)) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function instant(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be RFC 3339`)
  return new Date(value).toISOString()
}

function normalizeObservation(value, name) {
  assertObject(value, name, OBSERVATION_KEYS)
  if (!PLATFORMS.has(value.platform)) throw new Error(`${name}.platform is unsupported`)
  if (!STATES.has(value.state)) throw new Error(`${name}.state is unsupported`)
  if (!COMPLETENESS.has(value.completeness)) throw new Error(`${name}.completeness is unsupported`)
  if (value.unit !== 'count') throw new Error(`${name}.unit must be count in version 1`)
  if (!DIGEST.test(value.definitionDigest ?? '')) throw new Error(`${name}.definitionDigest must be sha256`)
  if (!DIGEST.test(value.scopeDigest ?? '')) throw new Error(`${name}.scopeDigest must be sha256`)
  const windowStart = instant(value.windowStart, `${name}.windowStart`)
  const windowEnd = instant(value.windowEnd, `${name}.windowEnd`)
  if (Date.parse(windowEnd) <= Date.parse(windowStart)) throw new Error(`${name} window must have positive duration`)
  if (value.state === 'observed') {
    if (!Number.isSafeInteger(value.value) || value.value < 0) throw new Error(`${name}.value must be a non-negative safe integer when observed`)
  } else if (value.value !== undefined) {
    throw new Error(`${name}.value must be absent unless state is observed`)
  }
  if (value.state === 'not-finalized' && value.finalizedAt !== undefined) throw new Error(`${name}.finalizedAt must be absent while not-finalized`)
  return {
    sourceRef: ref(value.sourceRef, `${name}.sourceRef`),
    platform: value.platform,
    surfaceRef: ref(value.surfaceRef, `${name}.surfaceRef`),
    metricRef: ref(value.metricRef, `${name}.metricRef`),
    definitionRef: ref(value.definitionRef, `${name}.definitionRef`),
    definitionDigest: value.definitionDigest,
    scopeDigest: value.scopeDigest,
    unit: value.unit,
    windowStart,
    windowEnd,
    state: value.state,
    ...(value.value === undefined ? {} : { value: value.value }),
    completeness: value.completeness,
    ...(value.finalizedAt === undefined ? {} : { finalizedAt: instant(value.finalizedAt, `${name}.finalizedAt`) }),
  }
}

function normalizeAttribution(value, name) {
  assertObject(value, name, ATTRIBUTION_KEYS)
  if (!ATTRIBUTION.has(value.method)) throw new Error(`${name}.method is unsupported`)
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length > 10) throw new Error(`${name}.evidenceRefs must contain at most 10 refs`)
  const evidenceRefs = value.evidenceRefs.map((item, index) => ref(item, `${name}.evidenceRefs[${index}]`)).sort()
  if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${name}.evidenceRefs must be unique`)
  if (value.method === 'platform-attributed' && evidenceRefs.length === 0) throw new Error(`${name}.platform-attributed requires evidence`)
  if (value.method !== 'platform-attributed' && evidenceRefs.length > 0) throw new Error(`${name}.evidenceRefs are only accepted for platform-attributed observations`)
  return { method: value.method, evidenceRefs }
}

export function normalizeDistributionImpactInput(input) {
  assertObject(input, 'input', INPUT_KEYS)
  assertObject(input.publication, 'publication', PUBLICATION_KEYS)
  const evaluatedAt = instant(input.evaluatedAt, 'evaluatedAt')
  const publication = {
    revisionRef: ref(input.publication.revisionRef, 'publication.revisionRef'),
    ...(input.publication.receiptRef === undefined ? {} : { receiptRef: ref(input.publication.receiptRef, 'publication.receiptRef') }),
    occurredAt: instant(input.publication.occurredAt, 'publication.occurredAt'),
  }
  if (Date.parse(publication.occurredAt) > Date.parse(evaluatedAt)) throw new Error('publication.occurredAt must not be in the future')
  if (!Array.isArray(input.comparisons) || input.comparisons.length < 1 || input.comparisons.length > 50) throw new Error('comparisons must contain between 1 and 50 items')
  const comparisons = input.comparisons.map((item, index) => {
    const name = `comparisons[${index}]`
    assertObject(item, name, COMPARISON_KEYS)
    const baseline = normalizeObservation(item.baseline, `${name}.baseline`)
    const current = normalizeObservation(item.current, `${name}.current`)
    if (baseline.platform !== current.platform || baseline.sourceRef !== current.sourceRef) throw new Error(`${name} cannot compare different platforms or sources`)
    return {
      comparisonRef: ref(item.comparisonRef, `${name}.comparisonRef`),
      baseline,
      current,
      attribution: normalizeAttribution(item.attribution, `${name}.attribution`),
    }
  }).sort((left, right) => left.comparisonRef.localeCompare(right.comparisonRef))
  if (new Set(comparisons.map((item) => item.comparisonRef)).size !== comparisons.length) throw new Error('comparisonRef values must be unique')
  return {
    evaluationRef: ref(input.evaluationRef, 'evaluationRef'),
    targetRef: ref(input.targetRef, 'targetRef'),
    publication,
    evaluatedAt,
    comparisons,
  }
}

function compareOne(comparison, publication, evaluatedAt) {
  const { baseline, current, attribution } = comparison
  const reasons = []
  const pending = baseline.state === 'not-finalized' || current.state === 'not-finalized' || (baseline.finalizedAt && Date.parse(baseline.finalizedAt) > Date.parse(evaluatedAt)) || (current.finalizedAt && Date.parse(current.finalizedAt) > Date.parse(evaluatedAt))
  if (pending) {
    reasons.push('window-not-finalized')
  }
  let unknown = false
  if (!pending && (baseline.state !== 'observed' || current.state !== 'observed')) {
    unknown = true
    reasons.push(`non-observed-state:${baseline.state}:${current.state}`)
  }
  const definitionDrift = baseline.definitionRef !== current.definitionRef || baseline.definitionDigest !== current.definitionDigest
  if (definitionDrift) {
    reasons.push('native-definition-changed')
  }
  if (baseline.metricRef !== current.metricRef || baseline.unit !== current.unit) {
    unknown = true
    reasons.push('native-metric-or-unit-mismatch')
  }
  if (baseline.surfaceRef !== current.surfaceRef || baseline.scopeDigest !== current.scopeDigest) {
    unknown = true
    reasons.push('surface-or-scope-mismatch')
  }
  const baselineDuration = Date.parse(baseline.windowEnd) - Date.parse(baseline.windowStart)
  const currentDuration = Date.parse(current.windowEnd) - Date.parse(current.windowStart)
  if (baselineDuration !== currentDuration || Date.parse(baseline.windowEnd) > Date.parse(current.windowStart)) {
    unknown = true
    reasons.push('window-not-comparable')
  }
  if (!pending && (baseline.completeness !== 'complete' || current.completeness !== 'complete')) {
    unknown = true
    reasons.push('window-incomplete')
  }
  const status = definitionDrift ? 'definition-drift' : pending ? 'pending' : unknown ? 'unknown' : 'comparable'
  const delta = status === 'comparable'
    ? { absolute: current.value - baseline.value, direction: current.value === baseline.value ? 'unchanged' : current.value > baseline.value ? 'increase' : 'decrease' }
    : null
  let attributionConclusion = 'unknown'
  if (status === 'comparable' && attribution.method === 'platform-attributed' && publication.receiptRef && Date.parse(current.windowStart) >= Date.parse(publication.occurredAt)) {
    attributionConclusion = 'platform-attributed'
  } else if (status === 'comparable' && attribution.method === 'temporal-only' && Date.parse(baseline.windowEnd) <= Date.parse(publication.occurredAt) && Date.parse(current.windowStart) >= Date.parse(publication.occurredAt)) {
    attributionConclusion = 'temporal-association'
    reasons.push('causality-not-established')
  } else if (status === 'comparable') {
    reasons.push(attribution.method === 'platform-attributed' ? 'publication-receipt-or-window-not-bound' : 'attribution-unavailable')
  }
  return {
    comparisonRef: comparison.comparisonRef,
    platform: baseline.platform,
    sourceRef: baseline.sourceRef,
    nativeMetricRef: baseline.metricRef,
    status,
    baselineState: baseline.state,
    currentState: current.state,
    delta,
    attributionConclusion,
    reasons: [...new Set(reasons)].sort(),
    evidenceRefs: attribution.method === 'platform-attributed' ? attribution.evidenceRefs : [],
  }
}

export function evaluateDistributionImpactObservations(input) {
  const normalized = normalizeDistributionImpactInput(input)
  const comparisons = normalized.comparisons.map((comparison) => compareOne(comparison, normalized.publication, normalized.evaluatedAt))
  const summary = {
    total: comparisons.length,
    comparable: comparisons.filter((item) => item.status === 'comparable').length,
    pending: comparisons.filter((item) => item.status === 'pending').length,
    unknown: comparisons.filter((item) => item.status === 'unknown' || item.status === 'definition-drift').length,
    platformAttributed: comparisons.filter((item) => item.attributionConclusion === 'platform-attributed').length,
    temporalAssociations: comparisons.filter((item) => item.attributionConclusion === 'temporal-association').length,
  }
  const payload = {
    schemaVersion: 'dsh.distribution-impact-observation-evaluation/v1',
    evaluationRef: normalized.evaluationRef,
    targetRef: normalized.targetRef,
    publicationRevisionRef: normalized.publication.revisionRef,
    publicationReceiptBound: Boolean(normalized.publication.receiptRef),
    evaluatedAt: normalized.evaluatedAt,
    comparisons,
    summary,
    noCrossPlatformScore: true,
    causalClaimGenerated: false,
    platformDataRead: false,
    knowledgeWritten: false,
    actionExecuted: false,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: `sha256:${digest(payload)}` }
}

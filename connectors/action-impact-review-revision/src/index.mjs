import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['candidate', 'impact', 'requestedAt', 'validForSeconds', 'evidenceRefs'])
const CANDIDATE_KEYS = new Set(['candidateRef', 'candidateDigest', 'actionName', 'effect', 'scopeRef', 'targetRefs', 'arguments', 'readiness', 'requiredMissing'])
const IMPACT_KEYS = new Set(['dataClasses', 'audience', 'reversibility', 'cost', 'consequenceRefs'])
const COST_KEYS = new Set(['kind', 'maximumMinorUnits', 'currency'])
const EFFECTS = new Set(['none', 'local-write', 'platform-write', 'financial', 'communication', 'identity-relationship'])
const DATA_CLASSES = new Set(['public', 'personal', 'confidential', 'credential'])
const AUDIENCES = new Set(['none', 'single-recipient', 'bounded-group', 'public', 'unknown'])
const REVERSIBILITY = new Set(['reversible', 'conditional', 'irreversible', 'unknown'])
const COST_KINDS = new Set(['none', 'bounded', 'unknown'])
const IDENTIFIER = /^[a-z][a-z0-9._-]{0,127}$/
const DIGEST = /^[0-9a-f]{64}$/
const CURRENCY = /^[A-Z]{3}$/

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

function boundedRef(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function scalar(value, name) {
  if (value === null || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`${name} must be a finite JSON scalar`)
  if (typeof value === 'string' && value.length > 2000) throw new Error(`${name} exceeds 2000 characters`)
  return value
}

function uniqueSortedRefs(values, name, { minimum = 0, maximum = 20 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} references`)
  const normalized = values.map((value, index) => boundedRef(value, `${name}[${index}]`))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
  return normalized.sort()
}

function uniqueSortedFields(values, name) {
  if (!Array.isArray(values) || values.length > 50) throw new Error(`${name} must contain at most 50 fields`)
  if (values.some((value) => typeof value !== 'string' || !/^[a-z][a-zA-Z0-9_]{0,63}$/.test(value))) throw new Error(`${name} contains an invalid field`)
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`)
  return [...values].sort()
}

function normalizeCandidate(candidate) {
  assertRecord(candidate, 'candidate')
  assertExactKeys(candidate, CANDIDATE_KEYS, 'candidate')
  if (typeof candidate.candidateDigest !== 'string' || !DIGEST.test(candidate.candidateDigest)) throw new Error('candidate.candidateDigest must be a SHA-256 hex digest')
  if (typeof candidate.actionName !== 'string' || !IDENTIFIER.test(candidate.actionName)) throw new Error('candidate.actionName is invalid')
  if (!EFFECTS.has(candidate.effect)) throw new Error('candidate.effect is unsupported')
  if (!['grounded', 'needs-clarification'].includes(candidate.readiness)) throw new Error('candidate.readiness is unsupported')
  const requiredMissing = uniqueSortedFields(candidate.requiredMissing, 'candidate.requiredMissing')
  if (candidate.readiness === 'grounded' && requiredMissing.length > 0) throw new Error('grounded candidate cannot contain requiredMissing')
  if (candidate.readiness === 'needs-clarification' && requiredMissing.length < 1) throw new Error('needs-clarification candidate must contain requiredMissing')
  assertRecord(candidate.arguments, 'candidate.arguments')
  if (Object.keys(candidate.arguments).length > 50) throw new Error('candidate.arguments exceeds 50 fields')
  const args = {}
  for (const key of Object.keys(candidate.arguments).sort()) {
    if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key)) throw new Error(`candidate.arguments field is invalid: ${key}`)
    args[key] = scalar(candidate.arguments[key], `candidate.arguments.${key}`)
  }
  return {
    candidateRef: boundedRef(candidate.candidateRef, 'candidate.candidateRef'),
    candidateDigest: candidate.candidateDigest,
    actionName: candidate.actionName,
    effect: candidate.effect,
    scopeRef: boundedRef(candidate.scopeRef, 'candidate.scopeRef'),
    targetRefs: uniqueSortedRefs(candidate.targetRefs, 'candidate.targetRefs', { minimum: 1, maximum: 10 }),
    arguments: args,
    readiness: candidate.readiness,
    requiredMissing,
  }
}

function normalizeImpact(impact) {
  assertRecord(impact, 'impact')
  assertExactKeys(impact, IMPACT_KEYS, 'impact')
  if (!Array.isArray(impact.dataClasses) || impact.dataClasses.length < 1 || impact.dataClasses.length > 4 || impact.dataClasses.some((item) => !DATA_CLASSES.has(item)) || new Set(impact.dataClasses).size !== impact.dataClasses.length) throw new Error('impact.dataClasses is invalid')
  if (!AUDIENCES.has(impact.audience)) throw new Error('impact.audience is unsupported')
  if (!REVERSIBILITY.has(impact.reversibility)) throw new Error('impact.reversibility is unsupported')
  assertRecord(impact.cost, 'impact.cost')
  assertExactKeys(impact.cost, COST_KEYS, 'impact.cost')
  if (!COST_KINDS.has(impact.cost.kind)) throw new Error('impact.cost.kind is unsupported')
  let cost
  if (impact.cost.kind === 'bounded') {
    if (!Number.isSafeInteger(impact.cost.maximumMinorUnits) || impact.cost.maximumMinorUnits < 0) throw new Error('bounded cost requires non-negative maximumMinorUnits')
    if (typeof impact.cost.currency !== 'string' || !CURRENCY.test(impact.cost.currency)) throw new Error('bounded cost requires ISO-style currency')
    cost = { kind: 'bounded', maximumMinorUnits: impact.cost.maximumMinorUnits, currency: impact.cost.currency }
  } else {
    if (impact.cost.maximumMinorUnits !== undefined || impact.cost.currency !== undefined) throw new Error(`${impact.cost.kind} cost cannot include amount or currency`)
    cost = { kind: impact.cost.kind }
  }
  return {
    dataClasses: [...impact.dataClasses].sort(),
    audience: impact.audience,
    reversibility: impact.reversibility,
    cost,
    consequenceRefs: uniqueSortedRefs(impact.consequenceRefs, 'impact.consequenceRefs', { maximum: 20 }),
  }
}

export function normalizeActionImpactReviewInput(input, { minimumValiditySeconds = 60, maximumValiditySeconds = 3600 } = {}) {
  assertRecord(input, 'input')
  assertExactKeys(input, INPUT_KEYS, 'input')
  if (!Number.isSafeInteger(minimumValiditySeconds) || !Number.isSafeInteger(maximumValiditySeconds) || minimumValiditySeconds < 30 || maximumValiditySeconds > 86400 || minimumValiditySeconds > maximumValiditySeconds) throw new Error('validity policy is invalid')
  if (!Number.isSafeInteger(input.validForSeconds) || input.validForSeconds < minimumValiditySeconds || input.validForSeconds > maximumValiditySeconds) throw new Error(`validForSeconds must be between ${minimumValiditySeconds} and ${maximumValiditySeconds}`)
  const requestedAt = new Date(input.requestedAt)
  if (Number.isNaN(requestedAt.getTime())) throw new Error('requestedAt must be date-time')
  return {
    candidate: normalizeCandidate(input.candidate),
    impact: normalizeImpact(input.impact),
    requestedAt: requestedAt.toISOString(),
    validForSeconds: input.validForSeconds,
    evidenceRefs: uniqueSortedRefs(input.evidenceRefs, 'evidenceRefs', { minimum: 1, maximum: 20 }),
  }
}

function classify(candidate, impact) {
  const signals = []
  if (candidate.effect === 'local-write') signals.push('local-write')
  if (candidate.effect === 'platform-write') signals.push('platform-write')
  if (candidate.effect === 'financial') signals.push('financial-effect')
  if (candidate.effect === 'communication') signals.push('external-communication')
  if (candidate.effect === 'identity-relationship') signals.push('identity-relationship')
  for (const dataClass of impact.dataClasses) if (dataClass !== 'public') signals.push(`${dataClass}-data`)
  if (impact.audience === 'public') signals.push('public-audience')
  if (impact.audience === 'unknown') signals.push('unknown-audience')
  if (impact.cost.kind === 'bounded') signals.push('bounded-cost')
  if (impact.cost.kind === 'unknown') signals.push('unknown-cost')
  if (impact.reversibility === 'irreversible') signals.push('irreversible')
  if (impact.reversibility === 'unknown') signals.push('unknown-reversibility')
  const critical = candidate.effect === 'financial' || impact.dataClasses.includes('credential') || impact.reversibility === 'irreversible' || impact.cost.kind === 'unknown'
  const high = ['platform-write', 'communication', 'identity-relationship'].includes(candidate.effect) || impact.dataClasses.includes('confidential') || ['public', 'unknown'].includes(impact.audience) || impact.reversibility === 'unknown' || impact.cost.kind === 'bounded'
  const medium = candidate.effect === 'local-write' || impact.dataClasses.includes('personal') || ['single-recipient', 'bounded-group'].includes(impact.audience) || impact.reversibility === 'conditional'
  return { reviewClass: critical ? 'critical' : high ? 'high' : medium ? 'medium' : 'low', riskSignals: [...new Set(signals)].sort() }
}

function reviewItems(candidate, impact) {
  const ids = ['exact-action-and-arguments', 'exact-targets-and-scope', 'declared-impact-and-consequences', 'validity-window-and-cancel']
  if (impact.dataClasses.some((item) => item !== 'public')) ids.push('data-use-and-disclosure')
  if (impact.audience !== 'none') ids.push('recipient-and-audience')
  if (impact.cost.kind !== 'none' || candidate.effect === 'financial') ids.push('cost-ceiling')
  if (impact.reversibility !== 'reversible') ids.push('reversibility-and-recovery')
  return ids.sort().map((id) => ({ id, status: 'pending' }))
}

function blockersFor(candidate, impact) {
  const blockers = []
  if (candidate.readiness !== 'grounded') blockers.push({ code: 'candidate-needs-clarification', refs: candidate.requiredMissing })
  if (candidate.effect !== 'none' && impact.consequenceRefs.length === 0) blockers.push({ code: 'consequence-evidence-required', refs: [] })
  if (candidate.effect === 'financial' && impact.cost.kind === 'none') blockers.push({ code: 'financial-cost-missing', refs: [] })
  if (candidate.effect === 'communication' && impact.audience === 'none') blockers.push({ code: 'communication-audience-missing', refs: [] })
  return blockers
}

export function prepareActionImpactReviewRevision(input, policy = {}) {
  const normalized = normalizeActionImpactReviewInput(input, policy)
  const expiresAt = new Date(Date.parse(normalized.requestedAt) + normalized.validForSeconds * 1000).toISOString()
  const classification = classify(normalized.candidate, normalized.impact)
  const blockers = blockersFor(normalized.candidate, normalized.impact)
  const base = {
    schemaVersion: 'dsh.action-impact-review-revision/v1',
    candidate: normalized.candidate,
    impact: normalized.impact,
    evidenceRefs: normalized.evidenceRefs,
    requestedAt: normalized.requestedAt,
    expiresAt,
    reviewClass: classification.reviewClass,
    riskSignals: classification.riskSignals,
    reviewItems: reviewItems(normalized.candidate, normalized.impact),
    reviewerDecision: null,
    authorizationGranted: false,
    confirmationTokenIssued: false,
    executionAuthorized: false,
  }
  if (blockers.length > 0) return { ...base, status: 'blocked', reviewRevisionHash: null, preflight: { blockers } }
  const revisionPayload = {
    schemaVersion: base.schemaVersion,
    candidate: base.candidate,
    impact: base.impact,
    evidenceRefs: base.evidenceRefs,
    requestedAt: base.requestedAt,
    expiresAt: base.expiresAt,
    reviewClass: base.reviewClass,
    riskSignals: base.riskSignals,
    reviewItems: base.reviewItems,
  }
  return { ...base, status: 'ready-for-human-review', reviewRevisionHash: digest(revisionPayload), preflight: { blockers: [] } }
}

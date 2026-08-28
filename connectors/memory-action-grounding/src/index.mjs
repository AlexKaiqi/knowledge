import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['action', 'explicitArguments', 'memoryClaims', 'now'])
const ACTION_KEYS = new Set(['name', 'effect', 'scopeRef', 'fields'])
const FIELD_KEYS = new Set(['path', 'type', 'required', 'memoryPolicy', 'enumValues'])
const CLAIM_KEYS = new Set(['id', 'actionName', 'scopeRef', 'fieldPath', 'value', 'authority', 'lifecycle', 'observedAt', 'validUntil', 'provenanceRefs'])
const EFFECTS = new Set(['none', 'local-write', 'platform-write', 'financial', 'communication', 'identity-relationship'])
const VALUE_TYPES = new Set(['string', 'number', 'integer', 'boolean'])
const MEMORY_POLICIES = new Set(['explicit-only', 'allow-user-confirmed', 'allow-confirmed-or-verified'])
const AUTHORITIES = new Set(['user-confirmed', 'tool-verified', 'assistant-inferred'])
const LIFECYCLES = new Set(['active', 'contested', 'superseded'])
const IDENTIFIER = /^[a-z][a-z0-9._-]{0,127}$/
const FIELD_PATH = /^[a-z][a-zA-Z0-9_]{0,63}$/

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function assertRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function cloneScalar(value, name) {
  if (value === null || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`${name} must be a finite JSON scalar`)
  if (typeof value === 'string' && value.length > 2000) throw new Error(`${name} exceeds 2000 characters`)
  return value
}

function scalarMatches(value, type) {
  if (type === 'integer') return Number.isInteger(value)
  return typeof value === type && (type !== 'number' || Number.isFinite(value))
}

function scalarKey(value) {
  return `${typeof value}:${JSON.stringify(value)}`
}

function normalizeField(field, index) {
  assertRecord(field, `action.fields[${index}]`)
  assertExactKeys(field, FIELD_KEYS, `action.fields[${index}]`)
  if (typeof field.path !== 'string' || !FIELD_PATH.test(field.path)) throw new Error(`action.fields[${index}].path must be a flat field name`)
  if (!VALUE_TYPES.has(field.type)) throw new Error(`action.fields[${index}].type is unsupported`)
  if (typeof field.required !== 'boolean') throw new Error(`action.fields[${index}].required must be boolean`)
  if (!MEMORY_POLICIES.has(field.memoryPolicy)) throw new Error(`action.fields[${index}].memoryPolicy is unsupported`)
  let enumValues
  if (field.enumValues !== undefined) {
    if (!Array.isArray(field.enumValues) || field.enumValues.length < 1 || field.enumValues.length > 50) throw new Error(`action.fields[${index}].enumValues must contain 1..50 values`)
    enumValues = field.enumValues.map((value, enumIndex) => cloneScalar(value, `action.fields[${index}].enumValues[${enumIndex}]`))
    if (enumValues.some((value) => !scalarMatches(value, field.type))) throw new Error(`action.fields[${index}].enumValues must match field type`)
    if (new Set(enumValues.map(scalarKey)).size !== enumValues.length) throw new Error(`action.fields[${index}].enumValues must be unique`)
  }
  return { path: field.path, type: field.type, required: field.required, memoryPolicy: field.memoryPolicy, ...(enumValues ? { enumValues } : {}) }
}

function normalizeClaim(claim, index) {
  assertRecord(claim, `memoryClaims[${index}]`)
  assertExactKeys(claim, CLAIM_KEYS, `memoryClaims[${index}]`)
  for (const [key, pattern] of [['id', IDENTIFIER], ['actionName', IDENTIFIER], ['fieldPath', FIELD_PATH]]) {
    if (typeof claim[key] !== 'string' || !pattern.test(claim[key])) throw new Error(`memoryClaims[${index}].${key} is invalid`)
  }
  if (typeof claim.scopeRef !== 'string' || claim.scopeRef.length < 1 || claim.scopeRef.length > 240) throw new Error(`memoryClaims[${index}].scopeRef is invalid`)
  if (!AUTHORITIES.has(claim.authority) || !LIFECYCLES.has(claim.lifecycle)) throw new Error(`memoryClaims[${index}] has unsupported governance metadata`)
  const observedAt = new Date(claim.observedAt)
  if (Number.isNaN(observedAt.getTime())) throw new Error(`memoryClaims[${index}].observedAt must be date-time`)
  let validUntil
  if (claim.validUntil !== undefined) {
    validUntil = new Date(claim.validUntil)
    if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() < observedAt.getTime()) throw new Error(`memoryClaims[${index}].validUntil is invalid`)
  }
  if (!Array.isArray(claim.provenanceRefs) || claim.provenanceRefs.length < 1 || claim.provenanceRefs.length > 10 || claim.provenanceRefs.some((ref) => typeof ref !== 'string' || ref.length < 1 || ref.length > 500)) throw new Error(`memoryClaims[${index}].provenanceRefs must contain 1..10 bounded references`)
  return {
    id: claim.id,
    actionName: claim.actionName,
    scopeRef: claim.scopeRef,
    fieldPath: claim.fieldPath,
    value: cloneScalar(claim.value, `memoryClaims[${index}].value`),
    authority: claim.authority,
    lifecycle: claim.lifecycle,
    observedAt: observedAt.toISOString(),
    ...(validUntil ? { validUntil: validUntil.toISOString() } : {}),
    provenanceRefs: [...new Set(claim.provenanceRefs)].sort(),
  }
}

export function normalizeGroundingInput(input) {
  assertRecord(input, 'input')
  assertExactKeys(input, INPUT_KEYS, 'input')
  assertRecord(input.action, 'action')
  assertExactKeys(input.action, ACTION_KEYS, 'action')
  if (typeof input.action.name !== 'string' || !IDENTIFIER.test(input.action.name)) throw new Error('action.name is invalid')
  if (!EFFECTS.has(input.action.effect)) throw new Error('action.effect is unsupported')
  if (typeof input.action.scopeRef !== 'string' || input.action.scopeRef.length < 1 || input.action.scopeRef.length > 240) throw new Error('action.scopeRef is invalid')
  if (!Array.isArray(input.action.fields) || input.action.fields.length < 1 || input.action.fields.length > 50) throw new Error('action.fields must contain 1..50 items')
  const fields = input.action.fields.map(normalizeField)
  if (new Set(fields.map((field) => field.path)).size !== fields.length) throw new Error('action field paths must be unique')
  assertRecord(input.explicitArguments, 'explicitArguments')
  const fieldMap = new Map(fields.map((field) => [field.path, field]))
  const explicitArguments = {}
  for (const [path, rawValue] of Object.entries(input.explicitArguments)) {
    const field = fieldMap.get(path)
    if (!field) throw new Error(`explicit argument is not declared: ${path}`)
    const value = cloneScalar(rawValue, `explicitArguments.${path}`)
    if (!scalarMatches(value, field.type)) throw new Error(`explicitArguments.${path} does not match ${field.type}`)
    if (field.enumValues && !field.enumValues.some((item) => scalarKey(item) === scalarKey(value))) throw new Error(`explicitArguments.${path} is outside enumValues`)
    explicitArguments[path] = value
  }
  if (!Array.isArray(input.memoryClaims) || input.memoryClaims.length > 200) throw new Error('memoryClaims must contain at most 200 items')
  const memoryClaims = input.memoryClaims.map(normalizeClaim)
  if (new Set(memoryClaims.map((claim) => claim.id)).size !== memoryClaims.length) throw new Error('memory claim ids must be unique')
  const now = new Date(input.now)
  if (Number.isNaN(now.getTime())) throw new Error('now must be date-time')
  return {
    action: { name: input.action.name, effect: input.action.effect, scopeRef: input.action.scopeRef, fields },
    explicitArguments,
    memoryClaims,
    now: now.toISOString(),
  }
}

function authorityAllowed(policy, authority) {
  if (policy === 'allow-user-confirmed') return authority === 'user-confirmed'
  if (policy === 'allow-confirmed-or-verified') return authority === 'user-confirmed' || authority === 'tool-verified'
  return false
}

function unresolvedReason(field, scopedClaims, now) {
  if (field.memoryPolicy === 'explicit-only') return 'explicit-required'
  if (scopedClaims.length === 0) return 'missing'
  if (scopedClaims.some((claim) => claim.lifecycle === 'contested')) return 'contested-memory'
  if (scopedClaims.every((claim) => claim.lifecycle !== 'active')) return 'inactive-memory'
  const active = scopedClaims.filter((claim) => claim.lifecycle === 'active')
  if (active.every((claim) => !authorityAllowed(field.memoryPolicy, claim.authority))) return 'unconfirmed-memory'
  const authoritative = active.filter((claim) => authorityAllowed(field.memoryPolicy, claim.authority))
  if (authoritative.length > 0 && authoritative.every((claim) => claim.validUntil && Date.parse(claim.validUntil) <= now)) return 'stale-memory'
  return 'invalid-memory'
}

export function groundMemoryIntoActionCandidate(input) {
  const normalized = normalizeGroundingInput(input)
  const now = Date.parse(normalized.now)
  const candidateArguments = { ...normalized.explicitArguments }
  const bindings = Object.keys(normalized.explicitArguments).sort().map((fieldPath) => ({ fieldPath, source: 'explicit', claimIds: [], provenanceRefs: [] }))
  const unresolved = []

  for (const field of normalized.action.fields) {
    if (Object.hasOwn(candidateArguments, field.path)) continue
    const scopedClaims = normalized.memoryClaims.filter((claim) => claim.actionName === normalized.action.name && claim.scopeRef === normalized.action.scopeRef && claim.fieldPath === field.path)
    const eligible = scopedClaims.filter((claim) => claim.lifecycle === 'active'
      && authorityAllowed(field.memoryPolicy, claim.authority)
      && (!claim.validUntil || Date.parse(claim.validUntil) > now)
      && scalarMatches(claim.value, field.type)
      && (!field.enumValues || field.enumValues.some((item) => scalarKey(item) === scalarKey(claim.value))))
    const values = new Map()
    for (const claim of eligible) {
      const key = scalarKey(claim.value)
      if (!values.has(key)) values.set(key, { value: claim.value, claims: [] })
      values.get(key).claims.push(claim)
    }
    if (values.size === 1) {
      const selected = [...values.values()][0]
      candidateArguments[field.path] = selected.value
      bindings.push({
        fieldPath: field.path,
        source: 'memory',
        claimIds: selected.claims.map((claim) => claim.id).sort(),
        provenanceRefs: [...new Set(selected.claims.flatMap((claim) => claim.provenanceRefs))].sort(),
      })
      continue
    }
    unresolved.push({
      fieldPath: field.path,
      required: field.required,
      reason: values.size > 1 ? 'conflicting-memory' : unresolvedReason(field, scopedClaims, now),
      claimIds: scopedClaims.map((claim) => claim.id).sort(),
    })
  }

  bindings.sort((left, right) => left.fieldPath.localeCompare(right.fieldPath))
  unresolved.sort((left, right) => left.fieldPath.localeCompare(right.fieldPath))
  const requiredMissing = unresolved.filter((item) => item.required).map((item) => item.fieldPath)
  const payload = {
    schemaVersion: 'dsh.memory-action-grounding/v1',
    actionName: normalized.action.name,
    effect: normalized.action.effect,
    scopeRef: normalized.action.scopeRef,
    candidateArguments,
    bindings,
    unresolved,
    readiness: requiredMissing.length === 0 ? 'grounded' : 'needs-clarification',
    requiredMissing,
    executionAuthorized: false,
    coverage: {
      fieldsDeclared: normalized.action.fields.length,
      fieldsBound: Object.keys(candidateArguments).length,
      memoryClaimsConsidered: normalized.memoryClaims.length,
      wrongScopeClaimsIgnored: normalized.memoryClaims.filter((claim) => claim.actionName !== normalized.action.name || claim.scopeRef !== normalized.action.scopeRef).length,
      textInterpretationPerformed: false,
    },
  }
  return { ...payload, resultDigest: digest(payload) }
}

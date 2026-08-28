import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['suiteRef', 'fixtureRevisionRef', 'cases'])
const CASE_KEYS = new Set(['caseRef', 'queryKind', 'evaluatedAt', 'targetScopeRef', 'memories', 'fields', 'observed'])
const MEMORY_KEYS = new Set(['memoryRef', 'factKey', 'valueDigest', 'state', 'scopeRef', 'effectiveAt', 'expiresAt', 'supersedesRefs'])
const FIELD_KEYS = new Set(['fieldRef', 'factKey', 'required', 'explicitValueDigest', 'explicitEvidenceRefs'])
const OBSERVED_KEYS = new Set(['ingestedMemoryRefs', 'retrievedMemoryRefs', 'selectedMemoryRefs', 'decision', 'fields'])
const OBSERVED_FIELD_KEYS = new Set(['fieldRef', 'valueDigest', 'evidenceRefs'])
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const DIGEST = /^sha256:[a-f0-9]{64}$/
const STATES = ['confirmed', 'contested', 'revoked']
const DECISIONS = ['answer', 'ask', 'abstain', 'action-candidate']
const STAGES = ['ingestion-coverage', 'retrieval-precision-and-coverage', 'version-and-scope-resolution', 'abstention-or-action-decision', 'evidence-grounded-utilization']

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`

function assertRecord(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !keys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function normalizeId(value, name) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Error(`${name} must be an opaque bounded identifier`)
  return value
}

function normalizeDigest(value, name, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(`${name} must be a sha256 digest`)
  return value
}

function normalizeTimestamp(value, name, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${name} must be a canonical date-time`)
  return value
}

function normalizeIds(values, name, minimum = 0, maximum = 100) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} identifiers`)
  const normalized = values.map((value, index) => normalizeId(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
  return normalized
}

function normalizeObservedField(item, name) {
  assertRecord(item, name, OBSERVED_FIELD_KEYS)
  return {
    fieldRef: normalizeId(item.fieldRef, `${name}.fieldRef`),
    valueDigest: normalizeDigest(item.valueDigest, `${name}.valueDigest`),
    evidenceRefs: normalizeIds(item.evidenceRefs, `${name}.evidenceRefs`, 1, 10),
  }
}

function normalizeCase(item, index) {
  const name = `cases[${index}]`
  assertRecord(item, name, CASE_KEYS)
  if (!['recall', 'action-parameters'].includes(item.queryKind)) throw new Error(`${name}.queryKind is unsupported`)
  if (!Array.isArray(item.memories) || item.memories.length > 100) throw new Error(`${name}.memories must contain 0..100 records`)
  const memories = item.memories.map((memory, memoryIndex) => {
    const memoryName = `${name}.memories[${memoryIndex}]`
    assertRecord(memory, memoryName, MEMORY_KEYS)
    if (!STATES.includes(memory.state)) throw new Error(`${memoryName}.state is unsupported`)
    const normalized = {
      memoryRef: normalizeId(memory.memoryRef, `${memoryName}.memoryRef`),
      factKey: normalizeId(memory.factKey, `${memoryName}.factKey`),
      valueDigest: normalizeDigest(memory.valueDigest, `${memoryName}.valueDigest`, true),
      state: memory.state,
      scopeRef: normalizeId(memory.scopeRef, `${memoryName}.scopeRef`),
      effectiveAt: normalizeTimestamp(memory.effectiveAt, `${memoryName}.effectiveAt`),
      expiresAt: normalizeTimestamp(memory.expiresAt, `${memoryName}.expiresAt`, true),
      supersedesRefs: normalizeIds(memory.supersedesRefs, `${memoryName}.supersedesRefs`, 0, 10),
    }
    if (normalized.state === 'revoked' && normalized.valueDigest !== null) throw new Error(`${memoryName}.revoked records cannot carry a value`)
    if (normalized.state !== 'revoked' && normalized.valueDigest === null) throw new Error(`${memoryName}.${normalized.state} records require a value`)
    if (normalized.state === 'revoked' && normalized.supersedesRefs.length < 1) throw new Error(`${memoryName}.revoked records must supersede at least one record`)
    if (normalized.state === 'contested' && normalized.supersedesRefs.length > 0) throw new Error(`${memoryName}.contested records cannot supersede records`)
    if (normalized.expiresAt !== null && Date.parse(normalized.expiresAt) <= Date.parse(normalized.effectiveAt)) throw new Error(`${memoryName}.expiresAt must follow effectiveAt`)
    return normalized
  }).sort((left, right) => left.memoryRef.localeCompare(right.memoryRef))
  if (new Set(memories.map((memory) => memory.memoryRef)).size !== memories.length) throw new Error(`${name}.memoryRef values must be unique`)
  const byRef = new Map(memories.map((memory) => [memory.memoryRef, memory]))
  for (const memory of memories) {
    for (const targetRef of memory.supersedesRefs) {
      const target = byRef.get(targetRef)
      if (!target) throw new Error(`${name}.${memory.memoryRef} supersedes an unknown record`)
      if (target.memoryRef === memory.memoryRef) throw new Error(`${name}.${memory.memoryRef} cannot supersede itself`)
      if (target.factKey !== memory.factKey || target.scopeRef !== memory.scopeRef) throw new Error(`${name}.${memory.memoryRef} supersession must preserve fact and scope`)
      if (Date.parse(memory.effectiveAt) < Date.parse(target.effectiveAt)) throw new Error(`${name}.${memory.memoryRef} cannot supersede a later record`)
    }
  }
  const visiting = new Set()
  const visited = new Set()
  function visit(memoryRef) {
    if (visiting.has(memoryRef)) throw new Error(`${name}.supersession graph must be acyclic`)
    if (visited.has(memoryRef)) return
    visiting.add(memoryRef)
    for (const targetRef of byRef.get(memoryRef).supersedesRefs) visit(targetRef)
    visiting.delete(memoryRef)
    visited.add(memoryRef)
  }
  for (const memory of memories) visit(memory.memoryRef)

  if (!Array.isArray(item.fields) || item.fields.length < 1 || item.fields.length > 20) throw new Error(`${name}.fields must contain 1..20 fields`)
  const fields = item.fields.map((field, fieldIndex) => {
    const fieldName = `${name}.fields[${fieldIndex}]`
    assertRecord(field, fieldName, FIELD_KEYS)
    if (typeof field.required !== 'boolean') throw new Error(`${fieldName}.required must be boolean`)
    const normalized = {
      fieldRef: normalizeId(field.fieldRef, `${fieldName}.fieldRef`),
      factKey: normalizeId(field.factKey, `${fieldName}.factKey`),
      required: field.required,
      explicitValueDigest: normalizeDigest(field.explicitValueDigest, `${fieldName}.explicitValueDigest`, true),
      explicitEvidenceRefs: normalizeIds(field.explicitEvidenceRefs, `${fieldName}.explicitEvidenceRefs`, 0, 10),
    }
    if (normalized.explicitValueDigest === null && normalized.explicitEvidenceRefs.length > 0) throw new Error(`${fieldName}.explicit evidence requires an explicit value`)
    if (normalized.explicitValueDigest !== null && normalized.explicitEvidenceRefs.length < 1) throw new Error(`${fieldName}.explicit value requires evidence`)
    return normalized
  }).sort((left, right) => left.fieldRef.localeCompare(right.fieldRef))
  if (new Set(fields.map((field) => field.fieldRef)).size !== fields.length) throw new Error(`${name}.fieldRef values must be unique`)
  if (new Set(fields.map((field) => field.factKey)).size !== fields.length) throw new Error(`${name}.factKey values must be unique across fields`)
  if (!fields.some((field) => field.required)) throw new Error(`${name} must include at least one required field`)

  assertRecord(item.observed, `${name}.observed`, OBSERVED_KEYS)
  if (!DECISIONS.includes(item.observed.decision)) throw new Error(`${name}.observed.decision is unsupported`)
  if (!Array.isArray(item.observed.fields) || item.observed.fields.length > fields.length) throw new Error(`${name}.observed.fields is oversized`)
  const observedFields = item.observed.fields.map((field, fieldIndex) => normalizeObservedField(field, `${name}.observed.fields[${fieldIndex}]`))
    .sort((left, right) => left.fieldRef.localeCompare(right.fieldRef))
  if (new Set(observedFields.map((field) => field.fieldRef)).size !== observedFields.length) throw new Error(`${name}.observed field refs must be unique`)
  const fieldRefs = new Set(fields.map((field) => field.fieldRef))
  if (observedFields.some((field) => !fieldRefs.has(field.fieldRef))) throw new Error(`${name}.observed fields must be declared`)
  const memoryRefs = new Set(memories.map((memory) => memory.memoryRef))
  const observed = {
    ingestedMemoryRefs: normalizeIds(item.observed.ingestedMemoryRefs, `${name}.observed.ingestedMemoryRefs`, 0, 100),
    retrievedMemoryRefs: normalizeIds(item.observed.retrievedMemoryRefs, `${name}.observed.retrievedMemoryRefs`, 0, 100),
    selectedMemoryRefs: normalizeIds(item.observed.selectedMemoryRefs, `${name}.observed.selectedMemoryRefs`, 0, 100),
    decision: item.observed.decision,
    fields: observedFields,
  }
  for (const ref of [...observed.ingestedMemoryRefs, ...observed.retrievedMemoryRefs, ...observed.selectedMemoryRefs]) if (!memoryRefs.has(ref)) throw new Error(`${name}.observed references an unknown memory record`)
  return {
    caseRef: normalizeId(item.caseRef, `${name}.caseRef`),
    queryKind: item.queryKind,
    evaluatedAt: normalizeTimestamp(item.evaluatedAt, `${name}.evaluatedAt`),
    targetScopeRef: normalizeId(item.targetScopeRef, `${name}.targetScopeRef`),
    memories,
    fields,
    observed,
  }
}

export function normalizeVersionedMemoryUseSuiteInput(input) {
  assertRecord(input, 'input', INPUT_KEYS)
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 50) throw new Error('cases must contain 1..50 items')
  const cases = input.cases.map(normalizeCase).sort((left, right) => left.caseRef.localeCompare(right.caseRef))
  if (new Set(cases.map((item) => item.caseRef)).size !== cases.length) throw new Error('caseRef values must be unique')
  return { suiteRef: normalizeId(input.suiteRef, 'suiteRef'), fixtureRevisionRef: normalizeId(input.fixtureRevisionRef, 'fixtureRevisionRef'), cases }
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function issue(code, refs = []) {
  return { code, refs: [...refs].sort() }
}

function deriveExpected(item) {
  const at = Date.parse(item.evaluatedAt)
  const applicable = item.memories.filter((memory) => memory.scopeRef === item.targetScopeRef && Date.parse(memory.effectiveAt) <= at)
  const superseded = new Set(applicable.filter((memory) => memory.state === 'confirmed' || memory.state === 'revoked').flatMap((memory) => memory.supersedesRefs))
  const topLevel = applicable.filter((memory) => !superseded.has(memory.memoryRef))
  const expectedIngested = new Set()
  const expectedRetrieved = new Set()
  const expectedSelected = new Set()
  const expectedFields = []
  let requiredUnresolved = false
  for (const field of item.fields) {
    if (field.explicitValueDigest !== null) {
      expectedFields.push({ fieldRef: field.fieldRef, valueDigest: field.explicitValueDigest, evidenceRefs: field.explicitEvidenceRefs })
      continue
    }
    const relevant = applicable.filter((memory) => memory.factKey === field.factKey)
    for (const memory of relevant) expectedIngested.add(memory.memoryRef)
    const heads = topLevel.filter((memory) => memory.factKey === field.factKey)
    for (const memory of heads) expectedRetrieved.add(memory.memoryRef)
    const liveConfirmed = heads.filter((memory) => memory.state === 'confirmed' && (memory.expiresAt === null || Date.parse(memory.expiresAt) > at))
    const resolved = heads.length === 1 && liveConfirmed.length === 1
    if (resolved) {
      const memory = liveConfirmed[0]
      expectedSelected.add(memory.memoryRef)
      expectedFields.push({ fieldRef: field.fieldRef, valueDigest: memory.valueDigest, evidenceRefs: [memory.memoryRef] })
    } else {
      for (const memory of heads) expectedSelected.add(memory.memoryRef)
      if (field.required) requiredUnresolved = true
    }
  }
  const decision = item.queryKind === 'recall'
    ? (requiredUnresolved ? 'abstain' : 'answer')
    : (requiredUnresolved ? 'ask' : 'action-candidate')
  return {
    decision,
    ingestedMemoryRefs: [...expectedIngested].sort(),
    retrievedMemoryRefs: [...expectedRetrieved].sort(),
    selectedMemoryRefs: [...expectedSelected].sort(),
    fields: expectedFields.sort((left, right) => left.fieldRef.localeCompare(right.fieldRef)),
  }
}

function evaluateCase(item) {
  const expected = deriveExpected(item)
  const stages = []
  const ingestionIssues = []
  const missingIngestion = expected.ingestedMemoryRefs.filter((ref) => !item.observed.ingestedMemoryRefs.includes(ref))
  const leakedIngestion = item.observed.ingestedMemoryRefs.filter((ref) => item.memories.find((memory) => memory.memoryRef === ref).scopeRef !== item.targetScopeRef)
  if (missingIngestion.length > 0) ingestionIssues.push(issue('ingestion-required-record-missing', missingIngestion))
  if (leakedIngestion.length > 0) ingestionIssues.push(issue('ingestion-cross-scope-record-present', leakedIngestion))
  stages.push({ id: STAGES[0], status: ingestionIssues.length === 0 ? 'passed' : 'failed', issues: ingestionIssues })

  const retrievalIssues = []
  const missingRetrieval = expected.retrievedMemoryRefs.filter((ref) => !item.observed.retrievedMemoryRefs.includes(ref))
  const unexpectedRetrieval = item.observed.retrievedMemoryRefs.filter((ref) => !expected.retrievedMemoryRefs.includes(ref))
  if (missingRetrieval.length > 0) retrievalIssues.push(issue('retrieval-required-record-missing', missingRetrieval))
  if (unexpectedRetrieval.length > 0) retrievalIssues.push(issue('retrieval-unexpected-record-present', unexpectedRetrieval))
  stages.push({ id: STAGES[1], status: retrievalIssues.length === 0 ? 'passed' : 'failed', issues: retrievalIssues })

  const versionIssues = equalArrays(expected.selectedMemoryRefs, item.observed.selectedMemoryRefs) ? [] : [issue('selected-version-set-mismatch', item.observed.selectedMemoryRefs)]
  stages.push({ id: STAGES[2], status: versionIssues.length === 0 ? 'passed' : 'failed', issues: versionIssues })

  const decisionIssues = expected.decision === item.observed.decision ? [] : [issue('decision-mismatch')]
  stages.push({ id: STAGES[3], status: decisionIssues.length === 0 ? 'passed' : 'failed', issues: decisionIssues })

  const utilizationIssues = stableStringify(expected.fields) === stableStringify(item.observed.fields) ? [] : [issue('field-value-or-evidence-mismatch')]
  stages.push({ id: STAGES[4], status: utilizationIssues.length === 0 ? 'passed' : 'failed', issues: utilizationIssues })
  const resultPayload = { caseRef: item.caseRef, queryKind: item.queryKind, evaluatedAt: item.evaluatedAt, targetScopeRef: item.targetScopeRef, expected, observed: item.observed, stages }
  return { ...resultPayload, status: stages.every((stage) => stage.status === 'passed') ? 'passed' : 'failed', resultDigest: digest(resultPayload) }
}

export function evaluateVersionedMemoryUseSuite(input) {
  const normalized = normalizeVersionedMemoryUseSuiteInput(input)
  const cases = normalized.cases.map(evaluateCase)
  const stagePassCounts = STAGES.map((stage) => ({ stage, passed: cases.filter((item) => item.stages.find((candidate) => candidate.id === stage).status === 'passed').length }))
  const summary = { caseCount: cases.length, passedCases: cases.filter((item) => item.status === 'passed').length, failedCases: cases.filter((item) => item.status === 'failed').length, stagePassCounts }
  const payload = {
    schemaVersion: 'dsh.versioned-memory-use-evaluation-suite/v1',
    suiteRef: normalized.suiteRef,
    fixtureRevisionRef: normalized.fixtureRevisionRef,
    policyRevision: 'versioned-memory-use-eval-2026-08-27',
    status: summary.failedCases === 0 ? 'passed' : 'failed',
    summary,
    cases,
    retention: 'opaque-digests-and-evaluation-only',
    memoryChanged: false,
    knowledgeWritten: false,
    actionExecuted: false,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: digest(payload) }
}

export { DECISIONS, STAGES }

import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateVersionedMemoryUseSuite } from '../src/index.mjs'

const hash = (character) => `sha256:${character.repeat(64)}`
const old = { memoryRef: 'memory:old', factKey: 'fact:address', valueDigest: hash('a'), state: 'confirmed', scopeRef: 'scope:owner', effectiveAt: '2026-01-01T00:00:00.000Z', expiresAt: null, supersedesRefs: [] }
const current = { memoryRef: 'memory:current', factKey: 'fact:address', valueDigest: hash('b'), state: 'confirmed', scopeRef: 'scope:owner', effectiveAt: '2026-02-01T00:00:00.000Z', expiresAt: null, supersedesRefs: ['memory:old'] }
const base = {
  suiteRef: 'suite:version-test', fixtureRevisionRef: 'fixture:v1',
  cases: [{
    caseRef: 'case:supersession', queryKind: 'action-parameters', evaluatedAt: '2026-03-01T00:00:00.000Z', targetScopeRef: 'scope:owner',
    memories: [old, current],
    fields: [{ fieldRef: 'field:address', factKey: 'fact:address', required: true, explicitValueDigest: null, explicitEvidenceRefs: [] }],
    observed: { ingestedMemoryRefs: ['memory:old', 'memory:current'], retrievedMemoryRefs: ['memory:current'], selectedMemoryRefs: ['memory:current'], decision: 'action-candidate', fields: [{ fieldRef: 'field:address', valueDigest: hash('b'), evidenceRefs: ['memory:current'] }] }
  }]
}

test('passes a deterministic explicitly superseded memory-use trace', () => {
  const first = evaluateVersionedMemoryUseSuite(base)
  const second = evaluateVersionedMemoryUseSuite(structuredClone(base))
  assert.equal(first.status, 'passed')
  assert.equal(first.resultDigest, second.resultDigest)
  assert.equal(first.cases[0].expected.selectedMemoryRefs[0], 'memory:current')
  assert.equal(first.memoryChanged || first.knowledgeWritten || first.actionExecuted || first.executionAuthorized, false)
})

test('attributes stale retrieval, stale selection, decision and utilization separately', () => {
  const input = structuredClone(base)
  input.cases[0].observed = { ingestedMemoryRefs: ['memory:old', 'memory:current'], retrievedMemoryRefs: ['memory:old'], selectedMemoryRefs: ['memory:old'], decision: 'ask', fields: [{ fieldRef: 'field:address', valueDigest: hash('a'), evidenceRefs: ['memory:old'] }] }
  const result = evaluateVersionedMemoryUseSuite(input)
  assert.equal(result.status, 'failed')
  assert.deepEqual(result.cases[0].stages.map((stage) => stage.status), ['passed', 'failed', 'failed', 'failed', 'failed'])
})

test('derives abstention from revocation and ask from unresolved conflict', () => {
  const revoked = { memoryRef: 'memory:revocation', factKey: 'fact:address', valueDigest: null, state: 'revoked', scopeRef: 'scope:owner', effectiveAt: '2026-02-02T00:00:00.000Z', expiresAt: null, supersedesRefs: ['memory:old'] }
  const recall = structuredClone(base.cases[0]); recall.caseRef = 'case:revoked'; recall.queryKind = 'recall'; recall.memories = [old, revoked]; recall.observed = { ingestedMemoryRefs: ['memory:old', 'memory:revocation'], retrievedMemoryRefs: ['memory:revocation'], selectedMemoryRefs: ['memory:revocation'], decision: 'abstain', fields: [] }
  const alternate = { ...old, memoryRef: 'memory:alternate', valueDigest: hash('c'), effectiveAt: '2026-01-02T00:00:00.000Z' }
  const conflict = structuredClone(base.cases[0]); conflict.caseRef = 'case:conflict'; conflict.memories = [old, alternate]; conflict.observed = { ingestedMemoryRefs: ['memory:old', 'memory:alternate'], retrievedMemoryRefs: ['memory:old', 'memory:alternate'], selectedMemoryRefs: ['memory:old', 'memory:alternate'], decision: 'ask', fields: [] }
  const result = evaluateVersionedMemoryUseSuite({ suiteRef: 'suite:unknown', fixtureRevisionRef: 'fixture:v1', cases: [recall, conflict] })
  assert.equal(result.status, 'passed')
})

test('explicit current values override memory without selecting it', () => {
  const input = structuredClone(base)
  input.cases[0].fields[0].explicitValueDigest = hash('d')
  input.cases[0].fields[0].explicitEvidenceRefs = ['request:current']
  input.cases[0].observed = { ingestedMemoryRefs: [], retrievedMemoryRefs: [], selectedMemoryRefs: [], decision: 'action-candidate', fields: [{ fieldRef: 'field:address', valueDigest: hash('d'), evidenceRefs: ['request:current'] }] }
  assert.equal(evaluateVersionedMemoryUseSuite(input).status, 'passed')
})

test('rejects hidden fields, invalid graphs, cross-fact supersession and undeclared observed refs', () => {
  assert.throws(() => evaluateVersionedMemoryUseSuite({ ...base, connectorId: 'hidden' }), /unsupported fields/)
  const cycle = structuredClone(base); cycle.cases[0].memories[0].effectiveAt = cycle.cases[0].memories[1].effectiveAt; cycle.cases[0].memories[0].supersedesRefs = ['memory:current']; assert.throws(() => evaluateVersionedMemoryUseSuite(cycle), /acyclic/)
  const crossFact = structuredClone(base); crossFact.cases[0].memories[1].factKey = 'fact:other'; assert.throws(() => evaluateVersionedMemoryUseSuite(crossFact), /preserve fact and scope/)
  const unknown = structuredClone(base); unknown.cases[0].observed.selectedMemoryRefs = ['memory:missing']; assert.throws(() => evaluateVersionedMemoryUseSuite(unknown), /unknown memory record/)
})

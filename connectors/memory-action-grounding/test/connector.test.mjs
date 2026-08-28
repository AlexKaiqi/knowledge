import assert from 'node:assert/strict'
import test from 'node:test'
import { groundMemoryIntoActionCandidate } from '../src/index.mjs'

const action = {
  name: 'schedule-reminder',
  effect: 'communication',
  scopeRef: 'owner:primary',
  fields: [
    { path: 'title', type: 'string', required: true, memoryPolicy: 'explicit-only' },
    { path: 'targetChannel', type: 'string', required: true, memoryPolicy: 'explicit-only', enumValues: ['current', 'mobile'] },
    { path: 'timezone', type: 'string', required: true, memoryPolicy: 'allow-user-confirmed' },
    { path: 'leadMinutes', type: 'integer', required: false, memoryPolicy: 'allow-user-confirmed' },
    { path: 'quietMode', type: 'boolean', required: false, memoryPolicy: 'allow-confirmed-or-verified' },
  ],
}

function claim(overrides = {}) {
  return {
    id: 'timezone-shanghai',
    actionName: 'schedule-reminder',
    scopeRef: 'owner:primary',
    fieldPath: 'timezone',
    value: 'Asia/Shanghai',
    authority: 'user-confirmed',
    lifecycle: 'active',
    observedAt: '2026-08-01T00:00:00Z',
    provenanceRefs: ['knowledge:user-preferences#timezone'],
    ...overrides,
  }
}

const baseInput = {
  action,
  explicitArguments: { title: 'Review feedback', targetChannel: 'current' },
  memoryClaims: [claim(), claim({ id: 'quiet-tool', fieldPath: 'quietMode', value: true, authority: 'tool-verified', provenanceRefs: ['settings:quiet-mode'] })],
  now: '2026-08-27T00:00:00Z',
}

test('binds explicit arguments and authoritative exact-scope memory without authorizing execution', () => {
  const result = groundMemoryIntoActionCandidate(baseInput)
  assert.deepEqual(result.candidateArguments, { title: 'Review feedback', targetChannel: 'current', timezone: 'Asia/Shanghai', quietMode: true })
  assert.equal(result.readiness, 'grounded')
  assert.equal(result.executionAuthorized, false)
  assert.deepEqual(result.bindings.find((item) => item.fieldPath === 'timezone').provenanceRefs, ['knowledge:user-preferences#timezone'])
})

test('conflicting active memories remain unresolved instead of choosing newest or highest authority', () => {
  const result = groundMemoryIntoActionCandidate({ ...baseInput, memoryClaims: [
    claim(),
    claim({ id: 'timezone-tokyo', value: 'Asia/Tokyo', observedAt: '2026-08-20T00:00:00Z', provenanceRefs: ['session:recent'] }),
  ] })
  assert.equal(Object.hasOwn(result.candidateArguments, 'timezone'), false)
  assert.deepEqual(result.requiredMissing, ['timezone'])
  assert.equal(result.unresolved.find((item) => item.fieldPath === 'timezone').reason, 'conflicting-memory')
})

test('stale, inferred, contested and wrong-scope memories cannot fill fields', () => {
  const cases = [
    [claim({ validUntil: '2026-08-20T00:00:00Z' }), 'stale-memory'],
    [claim({ authority: 'assistant-inferred' }), 'unconfirmed-memory'],
    [claim({ lifecycle: 'contested' }), 'contested-memory'],
  ]
  for (const [memoryClaim, expected] of cases) {
    const result = groundMemoryIntoActionCandidate({ ...baseInput, memoryClaims: [memoryClaim] })
    assert.equal(result.unresolved.find((item) => item.fieldPath === 'timezone').reason, expected)
  }
  const wrongScope = groundMemoryIntoActionCandidate({ ...baseInput, memoryClaims: [claim({ scopeRef: 'owner:other' })] })
  assert.equal(wrongScope.unresolved.find((item) => item.fieldPath === 'timezone').reason, 'missing')
  assert.equal(wrongScope.coverage.wrongScopeClaimsIgnored, 1)
})

test('explicit-only fields are never populated from memory', () => {
  const result = groundMemoryIntoActionCandidate({
    ...baseInput,
    explicitArguments: { title: 'Review feedback' },
    memoryClaims: [...baseInput.memoryClaims, claim({ id: 'channel-memory', fieldPath: 'targetChannel', value: 'mobile' })],
  })
  assert.equal(Object.hasOwn(result.candidateArguments, 'targetChannel'), false)
  assert.equal(result.unresolved.find((item) => item.fieldPath === 'targetChannel').reason, 'explicit-required')
})

test('explicit values win without silently rewriting a conflicting memory', () => {
  const result = groundMemoryIntoActionCandidate({ ...baseInput, explicitArguments: { ...baseInput.explicitArguments, timezone: 'Europe/London' } })
  assert.equal(result.candidateArguments.timezone, 'Europe/London')
  assert.equal(result.bindings.find((item) => item.fieldPath === 'timezone').source, 'explicit')
})

test('rejects undeclared fields, wrong scalar types, duplicate ids and nested values', () => {
  assert.throws(() => groundMemoryIntoActionCandidate({ ...baseInput, explicitArguments: { unknown: true } }), /not declared/)
  assert.throws(() => groundMemoryIntoActionCandidate({ ...baseInput, explicitArguments: { title: 'x', targetChannel: 'current', timezone: 8 } }), /does not match/)
  assert.throws(() => groundMemoryIntoActionCandidate({ ...baseInput, memoryClaims: [claim(), claim()] }), /ids must be unique/)
  assert.throws(() => groundMemoryIntoActionCandidate({ ...baseInput, memoryClaims: [claim({ value: { zone: 'Asia/Shanghai' } })] }), /JSON scalar/)
})

test('same frozen input produces the same candidate and digest', () => {
  assert.deepEqual(groundMemoryIntoActionCandidate(baseInput), groundMemoryIntoActionCandidate(baseInput))
})

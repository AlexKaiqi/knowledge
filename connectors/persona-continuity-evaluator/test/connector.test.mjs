import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { evaluatePersonaContinuitySuite, normalizeEvaluatorObservation, normalizePersonaContinuityInput } from '../src/index.mjs'

const fixture = JSON.parse(await readFile(new URL('../../../probes/fixtures/assistant/persona-continuity.json', import.meta.url), 'utf8'))
const evaluators = fixture.evaluators
const candidateByRef = new Map(fixture.evaluatorCandidates.map((item) => [item.evaluatorRef, item.candidate]))

test('preserves separate persona axes, system truth and evaluator disagreement without a score', async () => {
  const calls = []
  const result = await evaluatePersonaContinuitySuite(fixture.input, {
    evaluators,
    runEvaluator: async ({ evaluator }) => { calls.push(evaluator.evaluatorRef); return candidateByRef.get(evaluator.evaluatorRef) },
    now: () => new Date('2026-08-27T09:00:00Z'),
  })
  assert.deepEqual(calls, evaluators.map((item) => item.evaluatorRef).sort())
  assert.deepEqual(result.summary.cases, { total: 7, held: 2, deviated: 3, disagreement: 1, unknown: 1, 'not-applicable': 0 })
  assert.equal(result.cases.find((item) => item.caseRef === 'emotional-vulnerability').axes.find((axis) => axis.axis === 'style').status, 'disagreement')
  assert.equal(result.cases.find((item) => item.caseRef === 'system-state-conflict').systemTruth.status, 'deviated')
  assert.equal(result.cases.find((item) => item.caseRef === 'system-state-conflict').axes.every((axis) => axis.status === 'held'), true)
  assert.equal(result.cases.find((item) => item.caseRef === 'insufficient-context').status, 'unknown')
  assert.equal(result.noCompositeScore, true)
  assert.equal(Object.hasOwn(result, 'score'), false)
  assert.equal(result.evaluatorIndependenceClaimed, false)
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.personaChanged || result.memoryChanged || result.platformDataRead || result.actionExecuted || result.executionAuthorized, false)
})

test('rejects hidden input, missing axes and invented evidence refs', () => {
  assert.throws(() => normalizePersonaContinuityInput({ ...fixture.input, modelRouteRef: 'hidden' }), /unsupported fields/)
  const first = structuredClone(fixture.evaluatorCandidates[0].candidate)
  first.cases[0].axes.pop()
  assert.throws(() => normalizeEvaluatorObservation(first, { input: fixture.input, evaluator: evaluators[0] }), /cover every axis/)
  const invented = structuredClone(fixture.evaluatorCandidates[0].candidate)
  invented.cases[0].axes[0].responseSegmentRefs = ['invented-segment']
  assert.throws(() => normalizeEvaluatorObservation(invented, { input: fixture.input, evaluator: evaluators[0] }), /unknown reference/)
})

test('requires two versioned evaluator profiles and does not retain input text', async () => {
  await assert.rejects(evaluatePersonaContinuitySuite(fixture.input, { evaluators: evaluators.slice(0, 1), runEvaluator: async () => fixture.evaluatorCandidates[0].candidate }), /2\.\.4 evaluator profiles/)
  const result = await evaluatePersonaContinuitySuite(fixture.input, { evaluators, runEvaluator: async ({ evaluator }) => candidateByRef.get(evaluator.evaluatorRef), now: () => new Date('2026-08-27T09:00:00Z') })
  const serialized = JSON.stringify(result)
  for (const item of fixture.input.cases.flatMap((candidate) => [...candidate.contextSegments, ...candidate.responseSegments])) assert.equal(serialized.includes(item.text), false)
  for (const rule of fixture.input.persona.rules) assert.equal(serialized.includes(rule.statement), false)
})

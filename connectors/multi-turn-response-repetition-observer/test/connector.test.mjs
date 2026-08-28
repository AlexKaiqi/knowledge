import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { normalizeRepetitionInput, observeMultiTurnResponseRepetition } from '../src/index.mjs'

const fixture = JSON.parse(await readFile(new URL('../../../probes/fixtures/assistant/multi-turn-response-repetition.json', import.meta.url), 'utf8'))
const fixedNow = () => new Date('2026-08-27T10:00:00Z')

test('observes multilingual exact and n-gram repetition without producing a quality score', () => {
  const result = observeMultiTurnResponseRepetition(fixture, { now: fixedNow })
  assert.deepEqual(result.cases.map((item) => item.caseRef), ['chinese-planning', 'english-planning'])
  assert.equal(result.summary.caseCount, 2)
  assert.equal(result.summary.responseCount, 9)
  assert.equal(result.summary.exactRepeatPairCount, 3)
  assert.equal(result.summary.contextualizedExactRepeatPairCount, 2)
  assert.equal(result.summary.uncontextualizedExactRepeatPairCount, 1)
  assert.ok(result.summary.bigram.repeated > 0)
  assert.ok(result.summary.trigram.repeated > 0)
  assert.equal(result.policy.thresholdsApplied, false)
  assert.equal(Object.hasOwn(result, 'score'), false)
  assert.equal(result.interpretation.semanticRepetitionEvaluated, false)
  assert.equal(result.interpretation.responseQualityInferred, false)
  assert.equal(result.conformance.status, 'passed')
})

test('declared context preserves raw counts and short responses remain explicitly unavailable', () => {
  const result = observeMultiTurnResponseRepetition(fixture, { now: fixedNow })
  const english = result.cases.find((item) => item.caseRef === 'english-planning')
  const repeated = english.observations.find((item) => item.responseRef === 'turn-two')
  const short = english.observations.find((item) => item.responseRef === 'turn-six')
  assert.deepEqual(repeated.exactPriorResponseRefs, ['turn-one'])
  assert.equal(repeated.repeatContexts[0].kind, 'confirmation-readback')
  assert.equal(short.bigram.status, 'unavailable')
  assert.equal(short.trigram.status, 'unavailable')
  assert.equal(result.summary.exactRepeatPairCount, result.summary.contextualizedExactRepeatPairCount + result.summary.uncontextualizedExactRepeatPairCount)
})

test('is deterministic for a fixed observation time and does not retain input text', () => {
  const first = observeMultiTurnResponseRepetition(fixture, { now: fixedNow })
  const second = observeMultiTurnResponseRepetition(structuredClone(fixture), { now: fixedNow })
  assert.deepEqual(first, second)
  const serialized = JSON.stringify(first)
  for (const value of fixture.cases.flatMap((item) => item.responses.map((response) => response.text))) assert.equal(serialized.includes(value), false)
  assert.equal(first.personaChanged || first.memoryChanged || first.platformDataRead || first.actionExecuted || first.executionAuthorized, false)
})

test('rejects hidden fields, invalid ordering and unsupported contextualization', () => {
  assert.throws(() => normalizeRepetitionInput({ ...fixture, modelRouteRef: 'hidden' }), /unsupported fields/)
  const duplicate = structuredClone(fixture)
  duplicate.cases[0].responses[1].responseRef = duplicate.cases[0].responses[0].responseRef
  assert.throws(() => normalizeRepetitionInput(duplicate), /must be unique/)
  const invalidLocale = structuredClone(fixture)
  invalidLocale.cases[0].locale = 'not_a_locale'
  assert.throws(() => normalizeRepetitionInput(invalidLocale), /valid BCP 47 locale/)
  const future = structuredClone(fixture)
  future.cases[0].repeatContexts[0].priorResponseRef = 'turn-three'
  assert.throws(() => normalizeRepetitionInput(future), /must precede/)
  const noOverlap = structuredClone(fixture)
  noOverlap.cases[0].repeatContexts[0] = {
    currentResponseRef: 'turn-six', priorResponseRef: 'turn-five', kind: 'other-reviewed-context', evidenceRefs: ['fixture:no-overlap'],
  }
  assert.throws(() => observeMultiTurnResponseRepetition(noOverlap, { now: fixedNow }), /no observed lexical repetition/)
})

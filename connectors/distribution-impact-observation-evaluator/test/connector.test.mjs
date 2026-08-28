import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { evaluateDistributionImpactObservations } from '../src/index.mjs'

const fixture = JSON.parse(await readFile(new URL('../../../probes/fixtures/distribution/impact-observation-evaluation.json', import.meta.url), 'utf8'))

test('evaluates native impact observations without producing a cross-platform score', () => {
  const result = evaluateDistributionImpactObservations(fixture)
  assert.deepEqual(result.summary, { total: 6, comparable: 3, pending: 1, unknown: 2, platformAttributed: 1, temporalAssociations: 1 })
  assert.equal(result.noCrossPlatformScore, true)
  assert.equal(result.causalClaimGenerated, false)
  assert.equal(result.platformDataRead || result.knowledgeWritten || result.actionExecuted || result.executionAuthorized, false)
})

test('keeps suppression, finalization and definition drift distinct from zero', () => {
  const result = evaluateDistributionImpactObservations(fixture)
  const byRef = new Map(result.comparisons.map((item) => [item.comparisonRef, item]))
  assert.equal(byRef.get('apple:downloads-suppressed').status, 'unknown')
  assert.equal(byRef.get('apple:downloads-suppressed').delta, null)
  assert.equal(byRef.get('apple:views-not-finalized').status, 'pending')
  assert.equal(byRef.get('apple:views-not-finalized').delta, null)
  assert.equal(byRef.get('play:definition-drift').status, 'definition-drift')
  assert.equal(byRef.get('play:definition-drift').reasons.includes('native-definition-changed'), true)
})

test('distinguishes platform attribution, temporal association and unknown attribution', () => {
  const result = evaluateDistributionImpactObservations(fixture)
  const byRef = new Map(result.comparisons.map((item) => [item.comparisonRef, item]))
  assert.deepEqual(byRef.get('steam:tracked-visits-attributed').delta, { absolute: 30, direction: 'increase' })
  assert.equal(byRef.get('steam:tracked-visits-attributed').attributionConclusion, 'platform-attributed')
  assert.equal(byRef.get('steam:total-visits-temporal').attributionConclusion, 'temporal-association')
  assert.equal(byRef.get('steam:total-visits-temporal').reasons.includes('causality-not-established'), true)
  assert.equal(byRef.get('play:clicks-unattributed').attributionConclusion, 'unknown')
  assert.deepEqual(byRef.get('play:clicks-unattributed').delta, { absolute: 15, direction: 'increase' })
})

test('platform attribution fails closed without an exact publication receipt', () => {
  const input = structuredClone(fixture)
  delete input.publication.receiptRef
  const result = evaluateDistributionImpactObservations(input)
  const comparison = result.comparisons.find((item) => item.comparisonRef === 'steam:tracked-visits-attributed')
  assert.equal(comparison.status, 'comparable')
  assert.equal(comparison.attributionConclusion, 'unknown')
  assert.equal(comparison.reasons.includes('publication-receipt-or-window-not-bound'), true)
})

test('ordering is deterministic while cross-platform pairs and hidden fields are rejected', () => {
  const reversed = { ...fixture, comparisons: [...fixture.comparisons].reverse() }
  assert.deepEqual(evaluateDistributionImpactObservations(fixture), evaluateDistributionImpactObservations(reversed))
  const crossPlatform = structuredClone(fixture)
  crossPlatform.comparisons[0].current.platform = 'google-play'
  assert.throws(() => evaluateDistributionImpactObservations(crossPlatform), /cannot compare different platforms/)
  const hidden = structuredClone(fixture)
  hidden.comparisons[0].baseline.accountId = 'must-not-enter'
  assert.throws(() => evaluateDistributionImpactObservations(hidden), /unsupported fields/)
  const suppressedValue = structuredClone(fixture)
  suppressedValue.comparisons[1].current.value = 0
  assert.throws(() => evaluateDistributionImpactObservations(suppressedValue), /must be absent/)
  const duplicate = structuredClone(fixture)
  duplicate.comparisons[1].comparisonRef = duplicate.comparisons[0].comparisonRef
  assert.throws(() => evaluateDistributionImpactObservations(duplicate), /must be unique/)
})

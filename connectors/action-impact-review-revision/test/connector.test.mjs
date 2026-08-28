import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareActionImpactReviewRevision } from '../src/index.mjs'

const input = {
  candidate: {
    candidateRef: 'runtime:action-candidates/reminder-1',
    candidateDigest: '2e79de34108c35250c52dc7a058c2046a42d6a8bf79ab0c06c734840270f3aa2',
    actionName: 'schedule-reminder',
    effect: 'communication',
    scopeRef: 'owner:primary',
    targetRefs: ['channel:current'],
    arguments: { quietMode: true, targetChannel: 'current', timezone: 'Asia/Shanghai', title: 'Review feedback' },
    readiness: 'grounded',
    requiredMissing: [],
  },
  impact: {
    dataClasses: ['personal'],
    audience: 'single-recipient',
    reversibility: 'reversible',
    cost: { kind: 'none' },
    consequenceRefs: ['contract:schedule-reminder'],
  },
  requestedAt: '2026-08-27T05:00:00Z',
  validForSeconds: 600,
  evidenceRefs: ['candidate:2e79de34108c35250c52dc7a058c2046a42d6a8bf79ab0c06c734840270f3aa2'],
}

test('prepares a deterministic exact-target review revision without granting authority', () => {
  const first = prepareActionImpactReviewRevision(input)
  const replay = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, targetRefs: [...input.candidate.targetRefs] } })
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.reviewRevisionHash, replay.reviewRevisionHash)
  assert.equal(first.reviewClass, 'high')
  assert.deepEqual(first.riskSignals, ['external-communication', 'personal-data'])
  assert.equal(first.reviewItems.some((item) => item.id === 'exact-action-and-arguments'), true)
  assert.equal(first.reviewItems.some((item) => item.id === 'recipient-and-audience'), true)
  assert.equal(first.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(first.expiresAt, '2026-08-27T05:10:00.000Z')
  assert.equal(first.reviewerDecision, null)
  assert.equal(first.authorizationGranted, false)
  assert.equal(first.confirmationTokenIssued, false)
  assert.equal(first.executionAuthorized, false)
})

test('any exact action, argument, target or validity change creates a different revision', () => {
  const base = prepareActionImpactReviewRevision(input)
  const variants = [
    { ...input, candidate: { ...input.candidate, actionName: 'send-reminder' } },
    { ...input, candidate: { ...input.candidate, arguments: { ...input.candidate.arguments, quietMode: false } } },
    { ...input, candidate: { ...input.candidate, targetRefs: ['channel:other'] } },
    { ...input, validForSeconds: 900 },
  ]
  for (const variant of variants) assert.notEqual(prepareActionImpactReviewRevision(variant).reviewRevisionHash, base.reviewRevisionHash)
})

test('escalates irreversible, credential or financial impact conservatively', () => {
  const irreversible = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, effect: 'platform-write' }, impact: { ...input.impact, dataClasses: ['credential'], audience: 'public', reversibility: 'irreversible' } })
  assert.equal(irreversible.reviewClass, 'critical')
  assert.equal(irreversible.riskSignals.includes('credential-data'), true)
  assert.equal(irreversible.riskSignals.includes('irreversible'), true)
  assert.equal(irreversible.riskSignals.includes('public-audience'), true)

  const financial = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, effect: 'financial' }, impact: { ...input.impact, audience: 'none', cost: { kind: 'bounded', maximumMinorUnits: 100, currency: 'CNY' } } })
  assert.equal(financial.reviewClass, 'critical')
  assert.equal(financial.reviewItems.some((item) => item.id === 'cost-ceiling'), true)
})

test('blocks incomplete candidates and missing effect-specific declarations', () => {
  const incomplete = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, readiness: 'needs-clarification', requiredMissing: ['timezone'] } })
  assert.equal(incomplete.status, 'blocked')
  assert.equal(incomplete.reviewRevisionHash, null)
  assert.deepEqual(incomplete.preflight.blockers[0], { code: 'candidate-needs-clarification', refs: ['timezone'] })

  const financial = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, effect: 'financial' }, impact: { ...input.impact, audience: 'none', cost: { kind: 'none' }, consequenceRefs: [] } })
  assert.equal(financial.preflight.blockers.some((item) => item.code === 'financial-cost-missing'), true)
  assert.equal(financial.preflight.blockers.some((item) => item.code === 'consequence-evidence-required'), true)

  const communication = prepareActionImpactReviewRevision({ ...input, impact: { ...input.impact, audience: 'none' } })
  assert.equal(communication.preflight.blockers.some((item) => item.code === 'communication-audience-missing'), true)
})

test('rejects hidden fields, malformed digests, duplicate targets and invalid cost shapes', () => {
  assert.throws(() => prepareActionImpactReviewRevision({ ...input, confirmed: true }), /unsupported fields/)
  assert.throws(() => prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, candidateDigest: 'not-a-digest' } }), /SHA-256/)
  assert.throws(() => prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, targetRefs: ['channel:current', 'channel:current'] } }), /unique/)
  assert.throws(() => prepareActionImpactReviewRevision({ ...input, impact: { ...input.impact, cost: { kind: 'none', maximumMinorUnits: 1 } } }), /cannot include/)
  assert.throws(() => prepareActionImpactReviewRevision({ ...input, validForSeconds: 86400 }), /between/)
})

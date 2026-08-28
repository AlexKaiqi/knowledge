import assert from 'node:assert/strict'
import test from 'node:test'
import { collectSteamContentSurveyRevisionMaintenance, steamContentSurveySources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: '0'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const report = { expiresAt: '2026-09-27T00:00:00Z' }

test('current official survey, rating and review rules remain proposal-free', async () => {
  const result = await collectSteamContentSurveyRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource, report })
  assert.equal(steamContentSurveySources.length, 3)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('official semantic drift creates a proposal without changing questionnaire answers', async () => {
  const result = await collectSteamContentSurveyRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'steam-content-survey' ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) } : currentSource(source), report })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-steam-content-survey-rule-change', sourceId: 'steam-content-survey', observedDigest: 'f'.repeat(64) }])
})

test('expired proof requests only an effect-free local rerun', async () => {
  const result = await collectSteamContentSurveyRevisionMaintenance({ now: () => new Date('2026-09-28T00:00:00Z'), sourceCheck: currentSource, report })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/steam-content-survey-review-revision-local.json' }])
})

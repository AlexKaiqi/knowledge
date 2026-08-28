import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDistributionImpactMaintenance, impactSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), assertions: source.observation.assertions.map((item) => ({ id: item.id, passed: true })) })
const currentReport = { expiresAt: '2026-09-10T07:50:32.301Z' }

test('maintainer stays current while four native metric sources and proof remain current', async () => {
  const result = await collectDistributionImpactMaintenance({ now: () => new Date('2026-08-27T08:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(impactSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('semantic drift and source failure create proposals without changing the evaluator', async () => {
  const result = await collectDistributionImpactMaintenance({
    now: () => new Date('2026-08-27T08:00:00Z'), report: currentReport,
    sourceCheck: async (source) => source.id === 'google-play-store-performance'
      ? { id: source.id, status: 'review-required', observedDigest: 'f'.repeat(64) }
      : source.id === 'apple-analytics-reports'
        ? { id: source.id, status: 'unreachable', detail: 'timeout' }
        : currentSource(source),
  })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((item) => item.action), ['recheck-native-impact-source', 'review-native-impact-semantics'])
})

test('expired proof requests only an effect-free local rerun', async () => {
  const result = await collectDistributionImpactMaintenance({ now: () => new Date('2026-09-11T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-local-probe', probeDefinitionRef: 'repo:/probes/definitions/distribution-impact-observation-evaluation-local.json' }])
})

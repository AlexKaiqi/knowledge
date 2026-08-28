import assert from 'node:assert/strict'
import test from 'node:test'
import { collectAppfiguresPublicAppReviewsMaintenance, officialSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, role: source.role, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentReport = { id: 'accepted-live-report', outcome: 'passed', expiresAt: '2026-09-03T00:00:00Z' }

test('maintainer is current only with current official semantics and fresh live evidence', async () => {
  const result = await collectAppfiguresPublicAppReviewsMaintenance({ now: () => new Date('2026-08-27T05:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.equal(officialSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('missing report proposes every account, license, identity and credit gate without running a probe', async () => {
  const result = await collectAppfiguresPublicAppReviewsMaintenance({ now: () => new Date('2026-08-27T05:00:00Z'), sourceCheck: currentSource, report: null })
  assert.equal(result.proposals.length, 1)
  assert.equal(result.proposals[0].action, 'prepare-approved-public-app-review-probe')
  assert.equal(result.proposals[0].requires.includes('commercial-use-determination'), true)
  assert.equal(result.proposals[0].requires.includes('at-least-five-credits'), true)
  assert.equal(/"(?:token|password)"\s*:/.test(JSON.stringify(result)), false)
})

test('maintainer keeps auth, product, review and license drift distinct', async () => {
  const result = await collectAppfiguresPublicAppReviewsMaintenance({
    now: () => new Date('2026-08-27T05:00:00Z'),
    sourceCheck: async (source) => {
      if (source.role === 'official-auth-contract') return { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'personal-access-token', passed: false }] }
      if (source.role === 'official-product-contract') return { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'store-id-route', passed: false }] }
      if (source.role === 'official-review-contract') return { id: source.id, role: source.role, status: 'unreachable', detail: 'timeout' }
      if (source.role === 'official-access-license-pricing') return { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'commercial-license', passed: false }] }
      return currentSource(source)
    },
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-app-data-authentication-contract',
    'review-store-product-resolution-contract',
    'restore-app-data-source-observation',
    'review-app-data-credits-and-license',
  ])
})

test('expired evidence only proposes another approved live probe', async () => {
  const result = await collectAppfiguresPublicAppReviewsMaintenance({ now: () => new Date('2026-09-04T00:00:00Z'), sourceCheck: currentSource, report: currentReport })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-public-app-review-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/appfigures-public-app-reviews-live.json' }])
})

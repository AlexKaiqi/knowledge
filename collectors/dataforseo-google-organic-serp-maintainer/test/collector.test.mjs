import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectDataForSeoGoogleOrganicSerpMaintenance,
  officialSources,
} from '../src/index.mjs'

const currentSource = async (source) => ({
  id: source.id,
  role: source.role,
  status: 'current',
  assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })),
})

const currentReport = { id: 'accepted-live-report', outcome: 'passed', expiresAt: '2026-09-03T00:00:00Z' }

test('maintainer is current only after official sources and a fresh accepted live report are current', async () => {
  const result = await collectDataForSeoGoogleOrganicSerpMaintenance({
    now: () => new Date('2026-08-27T03:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.equal(officialSources.length, 4)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('missing verification produces an approval proposal and never spends money', async () => {
  const result = await collectDataForSeoGoogleOrganicSerpMaintenance({
    now: () => new Date('2026-08-27T03:00:00Z'),
    sourceCheck: currentSource,
    report: null,
  })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.length, 1)
  assert.equal(result.proposals[0].action, 'prepare-approved-provider-probes')
  assert.deepEqual(result.proposals[0].requires, ['provider-account', 'credential-ref', 'identity-pool', 'live-cost-approval'])
  assert.equal(/"(?:login|password)"\s*:/.test(JSON.stringify(result)), false)
})

test('maintainer separates price, authentication and source reachability drift', async () => {
  const result = await collectDataForSeoGoogleOrganicSerpMaintenance({
    now: () => new Date('2026-08-27T03:00:00Z'),
    sourceCheck: async (source) => {
      if (source.role === 'official-pricing') return { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'live-unit-price', passed: false }] }
      if (source.role === 'official-auth-contract') return { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'basic-auth-only', passed: false }] }
      if (source.role === 'official-sandbox-contract') return { id: source.id, role: source.role, status: 'unreachable', detail: 'timeout' }
      return currentSource(source)
    },
    report: currentReport,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-provider-authentication-contract',
    'review-serp-price-and-cost-bounds',
    'restore-provider-source-observation',
  ])
})

test('expired live evidence only proposes an approved rerun', async () => {
  const result = await collectDataForSeoGoogleOrganicSerpMaintenance({
    now: () => new Date('2026-09-04T00:00:00Z'),
    sourceCheck: currentSource,
    report: currentReport,
  })
  assert.deepEqual(result.proposals, [{ kind: 'verification-report', action: 'rerun-live-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-organic-serp-live.json' }])
})

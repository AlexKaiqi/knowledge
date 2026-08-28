import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCoresignalJobPostingMaintenance, officialSources } from '../src/index.mjs'

test('collector remains proposal-only until account, agreement, identity and live probe are approved', async () => {
  const result = await collectCoresignalJobPostingMaintenance({
    now: () => new Date('2026-08-27T06:00:00Z'),
    sourceCheck: async (source) => ({ id: source.id, role: source.role, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) }),
    report: null,
  })
  assert.equal(result.status, 'review-required')
  assert.equal(result.sources.length, officialSources.length)
  assert.deepEqual(result.proposals, [{
    kind: 'verification-report',
    action: 'prepare-approved-job-posting-probe',
    probeDefinitionRef: 'repo:/probes/definitions/coresignal-job-posting-snapshot-live.json',
    requires: ['provider-account', 'trial-or-paid-data-agreement', 'commercial-research-use-determination', 'api-key-credential-ref', 'provider-probe-identity-and-pool', 'ten-credit-budget-approval', 'china-coverage-review'],
  }])
})

test('collector turns API or legal drift into scoped proposals', async () => {
  const result = await collectCoresignalJobPostingMaintenance({
    sourceCheck: async (source) => source.id === 'website-terms-boundary'
      ? { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'separate-agreement', passed: false }] }
      : { id: source.id, role: source.role, status: 'current', assertions: [] },
    report: { id: 'accepted-report', outcome: 'passed', expiresAt: '2099-01-01T00:00:00Z' },
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'review-job-data-license-and-provenance', sourceId: 'website-terms-boundary', failures: ['separate-agreement'] }])
})

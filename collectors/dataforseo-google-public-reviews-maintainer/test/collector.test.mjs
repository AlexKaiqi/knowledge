import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDataForSeoGooglePublicReviewMaintenance, officialSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, role: source.role, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })

test('collector remains proposal-only until account, target-use review, sandbox and capped live proof are approved', async () => {
  const result = await collectDataForSeoGooglePublicReviewMaintenance({ now: () => new Date('2026-08-27T14:00:00Z'), sourceCheck: currentSource, report: null })
  assert.equal(officialSources.length, 9)
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals, [{
    kind: 'verification-report',
    action: 'prepare-approved-dataforseo-google-public-review-probes',
    sandboxProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-sandbox.json',
    liveProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-live.json',
    requires: [
      'dataforseo-account-registration-and-terms-acceptance',
      'opaque-dataforseo-api-login-and-api-password',
      'approved-probe-identity-pool',
      'supplier-and-google-content-use-rights-review',
      'data-protection-review-for-self-disclosed-review-content',
      'sandbox-shape-and-redaction-pass',
      'trial-credit-or-approved-balance-with-auto-recharge-disabled',
      'duplicate-task-protection-and-suspend-resume-executor',
      'usd-0.002-live-cost-approval',
    ],
  }])
})

test('pricing, sensitive fields and target rights drift remain separate proposals', async () => {
  const failures = {
    'google-reviews-task-get': { role: 'official-result-and-sensitive-field-contract', id: 'reviewer-profile-field' },
    'google-reviews-pricing': { role: 'official-pricing-and-turnaround-contract', id: 'standard-unit-price' },
    'google-maps-end-user-terms': { role: 'target-platform-content-use-boundary', id: 'copy-restricted' },
  }
  const result = await collectDataForSeoGooglePublicReviewMaintenance({
    sourceCheck: async (source) => failures[source.id] ? { id: source.id, role: failures[source.id].role, status: 'review-required', assertions: [{ id: failures[source.id].id, passed: false }] } : currentSource(source),
    report: { id: 'fresh', outcome: 'passed', expiresAt: '2099-01-01T00:00:00Z' },
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-dataforseo-google-review-field-or-redaction-change',
    'review-dataforseo-google-review-price-or-account-change',
    'review-dataforseo-google-review-use-or-rights-change',
  ])
})

test('unreachable source and expired proof only request review and an approved rerun', async () => {
  const result = await collectDataForSeoGooglePublicReviewMaintenance({
    now: () => new Date('2026-08-27T14:00:00Z'),
    sourceCheck: async (source) => source.id === 'dataforseo-error-lifecycle' ? { id: source.id, role: source.role, status: 'unreachable', httpStatus: 503 } : currentSource(source),
    report: { id: 'old', outcome: 'passed', expiresAt: '2026-08-27T13:59:59Z' },
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'restore-dataforseo-google-review-source-observation', sourceId: 'dataforseo-error-lifecycle', reason: 'HTTP_503' },
    { kind: 'verification-report', action: 'rerun-dataforseo-google-public-review-probes-after-approval', liveProbeDefinitionRef: 'repo:/probes/definitions/dataforseo-google-public-reviews-live.json' },
  ])
})

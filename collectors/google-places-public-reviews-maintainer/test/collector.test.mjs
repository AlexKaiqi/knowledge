import assert from 'node:assert/strict'
import test from 'node:test'
import { collectGooglePlacesPublicReviewMaintenance, officialSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, role: source.role, status: 'current', assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })

test('collector remains proposal-only until identity, policy surface and capped live probe are approved', async () => {
  const result = await collectGooglePlacesPublicReviewMaintenance({
    now: () => new Date('2026-08-27T13:00:00Z'),
    sourceCheck: currentSource,
    report: null,
  })
  assert.equal(officialSources.length, 6)
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals, [{
    kind: 'verification-report',
    action: 'prepare-approved-google-places-public-review-probe',
    probeDefinitionRef: 'repo:/probes/definitions/google-places-public-reviews-live.json',
    requires: [
      'google-cloud-project-and-billing',
      'places-api-new-enabled',
      'restricted-api-key-credential-ref',
      'probe-identity-and-pool',
      'maps-platform-terms-and-eea-status-review',
      'public-terms-privacy-and-google-maps-attribution-surface',
      'ephemeral-author-attribution-display',
      'no-durable-places-content-or-identity-graph',
      'usd-0.03-cost-approval',
    ],
  }])
})

test('policy, pricing and API drift remain separate proposals without changing the candidate', async () => {
  const failedById = {
    'places-policies-and-attributions': { role: 'official-retention-and-attribution-policy', failure: 'credit-author' },
    'places-current-pricing': { role: 'official-pricing-contract', failure: 'first-tier-price' },
    'text-search-new': { role: 'official-resolution-contract', failure: 'page-size' },
  }
  const result = await collectGooglePlacesPublicReviewMaintenance({
    sourceCheck: async (source) => failedById[source.id]
      ? { id: source.id, role: failedById[source.id].role, status: 'review-required', assertions: [{ id: failedById[source.id].failure, passed: false }] }
      : currentSource(source),
    report: { id: 'accepted-live-report', outcome: 'passed', expiresAt: '2099-01-01T00:00:00Z' },
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'review-google-places-api-contract-change', sourceId: 'text-search-new', failures: ['page-size'] },
    { kind: 'connector-change-proposal', action: 'review-google-places-retention-or-attribution-change', sourceId: 'places-policies-and-attributions', failures: ['credit-author'] },
    { kind: 'connector-change-proposal', action: 'review-google-places-price-or-field-billing-change', sourceId: 'places-current-pricing', failures: ['first-tier-price'] },
  ])
})

test('unreachable source and expired proof only request review and a newly approved probe', async () => {
  const result = await collectGooglePlacesPublicReviewMaintenance({
    now: () => new Date('2026-08-27T13:00:00Z'),
    sourceCheck: async (source) => source.id === 'review-rest-schema' ? { id: source.id, role: source.role, status: 'unreachable', httpStatus: 503 } : currentSource(source),
    report: { id: 'old-report', outcome: 'passed', expiresAt: '2026-08-27T12:59:59Z' },
  })
  assert.deepEqual(result.proposals, [
    { kind: 'connector-change-proposal', action: 'restore-google-places-source-observation', sourceId: 'review-rest-schema', reason: 'HTTP_503' },
    { kind: 'verification-report', action: 'rerun-google-places-public-review-probe-after-approval', probeDefinitionRef: 'repo:/probes/definitions/google-places-public-reviews-live.json' },
  ])
})

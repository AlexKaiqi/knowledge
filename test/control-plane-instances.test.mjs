import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

async function validator(schemaPath) {
  const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile(schema)
}

test('control-plane instances match their schemas', async () => {
  const cases = [
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-browser/connector.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/xiaohongshu-browser/routes.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/xiaohongshu-maintainer/sources.json'],
    ['../spec/ecosystem-project-catalog.schema.json', '../collectors/xiaohongshu-maintainer/projects.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-private-note-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-account-docs/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-account-docs-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-account-api-live.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-owned-notes-live.json'],
    ['../spec/probe-identity.schema.json', '../probes/identities/xiaohongshu-owned-default.json'],
    ['../spec/probe-identity-pool.schema.json', '../probes/pools/xiaohongshu-owned-probes.json'],
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-community-rules-browser/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-community-rules-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-community-rules-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/douyin-open-platform-docs/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-open-platform-docs-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/douyin-open-platform-docs-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/douyin-public-video-embed/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-public-video-embed-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/douyin-public-video-embed-live.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/douyin-access-routes/routes.json'],
    ['../spec/connector-definition.schema.json', '../connectors/tiktok-public-video-embed/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/tiktok-public-video-embed-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/tiktok-public-video-embed-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/youtube-public-video-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/youtube-public-video-search-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/youtube-public-video-search-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/youtube-public-video-search-live.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/video-platform-access-routes/routes.json'],
    ['../spec/collector-definition.schema.json', '../collectors/tiktok-route-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/tiktok-route-maintainer/sources.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-maintainer/collector.json'],
    ['../spec/ecosystem-project-catalog.schema.json', '../collectors/douyin-maintainer/projects.json'],
    ['../spec/connector-definition.schema.json', '../connectors/hugging-face-public-model-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/hugging-face-public-model-revision-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/hugging-face-public-model-revision-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/arxiv-public-metadata-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/arxiv-public-metadata-search-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/arxiv-public-metadata-search-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/arxiv-public-metadata-search-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/apple-public-app-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/apple-public-app-search-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/apple-public-app-search-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/apple-public-app-search-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-search-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-search-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-file/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-file-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-file-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-tags/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-tags-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-tags-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-release/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-release-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-release-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/evidence-backed-research-agent/connector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/evidence-backed-research-local.json'],
    ['../spec/collector-definition.schema.json', '../collectors/evidence-backed-research-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/evidence-backed-research-maintainer/sources.json'],
    ['../spec/connector-definition.schema.json', '../connectors/distribution-impact-observation-evaluator/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/distribution-impact-observation-evaluation-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/distribution-impact-observation-evaluation-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/distribution-impact-observation-evaluation-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/optifeed-radar-ai-readiness/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/optifeed-radar-ai-readiness-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/optifeed-radar-ai-readiness-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/public-state-pet-behavior-projector/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/public-state-pet-behavior-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/public-state-pet-behavior-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/public-state-pet-behavior-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/memory-action-grounding/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/memory-action-grounding-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/memory-action-grounding-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/memory-action-grounding-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/versioned-memory-use-evaluator/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/versioned-memory-use-evaluation-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/versioned-memory-use-evaluation-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/versioned-memory-use-evaluation-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/persona-continuity-evaluator/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/persona-continuity-evaluation-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/persona-continuity-evaluation-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/persona-continuity-evaluation-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/multi-turn-response-repetition-observer/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/multi-turn-response-repetition-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/multi-turn-response-repetition-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/multi-turn-response-repetition-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/bounded-work-context-projection/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/bounded-work-context-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/bounded-work-context-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/bounded-work-context-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/current-work-projection-maintainer/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/current-work-projection-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/current-work-projection-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/current-work-projection-maintenance-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/current-work-projection-reconciler/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/current-work-projection-reconciler-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/current-work-projection-reconciler-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/current-work-projection-reconciliation-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/action-impact-review-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/action-impact-review-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/action-impact-review-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/action-impact-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/dataforseo-google-organic-serp/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/dataforseo-google-organic-serp-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/dataforseo-google-organic-serp-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/dataforseo-google-organic-serp-sandbox.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/dataforseo-google-organic-serp-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/dataforseo-google-public-reviews/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/dataforseo-google-public-reviews-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/dataforseo-google-public-reviews-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/dataforseo-google-public-reviews-sandbox.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/dataforseo-google-public-reviews-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/appfigures-public-app-reviews/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/appfigures-public-app-reviews-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/appfigures-public-app-reviews-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/appfigures-public-app-reviews-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/openconnector-public-social-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/openconnector-upstream-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/openconnector-upstream-maintainer/sources.json'],
    ['../spec/ecosystem-project-catalog.schema.json', '../collectors/openconnector-upstream-maintainer/projects.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/openconnector-public-social-search-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/coresignal-job-posting-snapshot/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/coresignal-job-posting-snapshot-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/coresignal-job-posting-snapshot-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/coresignal-job-posting-snapshot-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-public-game-reviews/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-public-game-reviews-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-public-game-reviews-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-public-game-reviews-live.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-review-observation-projection-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/local-game-build-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/local-game-build-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/local-game-build-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/local-game-build-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-store-asset-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-store-asset-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-store-asset-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-store-asset-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-store-description-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-store-description-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-store-description-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-store-description-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-supported-feature-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-supported-feature-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-supported-feature-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-supported-feature-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-content-survey-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-content-survey-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-content-survey-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-content-survey-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-early-access-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-early-access-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-early-access-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-early-access-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-initial-release-date-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-initial-release-date-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-initial-release-date-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-initial-release-date-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-initial-base-price-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-initial-base-price-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-initial-base-price-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-initial-base-price-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/steam-system-requirements-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/steam-system-requirements-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/steam-system-requirements-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/steam-system-requirements-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/consented-feedback-intake-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/consented-feedback-intake-revision-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/consented-feedback-intake-revision-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/consented-feedback-intake-review-revision-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/feedback-intake-local-store/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/feedback-intake-local-store-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/feedback-intake-local-store-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/feedback-intake-local-storage-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/feedback-intake-local-withdrawal/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/feedback-intake-local-withdrawal-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/feedback-intake-local-withdrawal-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/feedback-intake-local-withdrawal-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/feedback-intake-local-retention-expiry/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/feedback-intake-local-retention-expiry-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/feedback-intake-local-retention-expiry-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/feedback-intake-local-retention-expiry-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/feedback-observation-reconciler/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/feedback-observation-reconciliation-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/feedback-observation-reconciliation-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/feedback-observation-reconciliation-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/feedback-theme-synthesis-agent/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/feedback-theme-synthesis-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/feedback-theme-synthesis-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/feedback-theme-synthesis-local.json'],
    ['../spec/connector-definition.schema.json', '../connectors/google-places-public-reviews/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/google-places-public-reviews-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/google-places-public-reviews-maintainer/sources.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/google-places-public-reviews-live.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/demand-signal-access-routes/routes.json'],
    ['../spec/collector-definition.schema.json', '../collectors/demand-signal-route-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/demand-signal-route-maintainer/sources.json'],
  ]
  for (const [schemaPath, instancePath] of cases) {
    const validate = await validator(schemaPath)
    const instance = JSON.parse(await readFile(new URL(instancePath, import.meta.url), 'utf8'))
    assert.equal(validate(instance), true, `${instancePath}: ${JSON.stringify(validate.errors)}`)
  }
})

test('Connector handlers can carry capability-specific conformance', async () => {
  const connector = JSON.parse(await readFile(new URL('../connectors/xiaohongshu-browser/connector.json', import.meta.url), 'utf8'))
  const publish = connector.handlers.find((handler) => handler.operation === 'publishPrivateNoteAndObserve')
  const listing = connector.handlers.find((handler) => handler.operation === 'listOwnedNotes')
  assert.equal(publish.conformance, undefined)
  assert.equal(connector.conformance.status, 'candidate')
  assert.equal(listing.conformance.status, 'verified')
  assert.equal(listing.conformance.probeReportRef, '/verifications/xiaohongshu/owned-notes/report.json')
})

test('demand route catalog exposes only the live-verified Apple public search route for automatic selection', async () => {
  const catalog = JSON.parse(await readFile(new URL('../connectors/demand-signal-access-routes/routes.json', import.meta.url), 'utf8'))
  const eligible = catalog.routes.filter((route) => route.automaticSelectionEligible)
  assert.equal(catalog.routes.length, 27)
  assert.deepEqual(eligible.map((route) => route.id), ['apple-itunes-public-app-search'])
  assert.equal(eligible[0].lifecycle, 'verified')
  assert.equal(eligible[0].contractLevel, 'full')
  assert.equal(eligible[0].capabilityCoverage[0].capabilityRef, '/capabilities/research/search-public-app-catalog.md')
  assert.equal(eligible[0].probeReportRef, '/verifications/apple/public-app-search/report.json')
  const googlePlaces = catalog.routes.find((route) => route.id === 'google-places-five-review')
  assert.equal(googlePlaces.lifecycle, 'candidate')
  assert.equal(googlePlaces.contractLevel, 'degraded')
  assert.equal(googlePlaces.automaticSelectionEligible, false)
  assert.equal(googlePlaces.connectorId, 'google-places-public-reviews')
  assert.equal(googlePlaces.probeDefinitionRef, 'repo:/probes/definitions/google-places-public-reviews-live.json')
  assert.equal(googlePlaces.capabilityCoverage[0].phases.includes('cleanup'), true)
  const deepGoogleReviews = catalog.routes.find((route) => route.id === 'google-public-reviews-dataforseo')
  assert.equal(deepGoogleReviews.lifecycle, 'candidate')
  assert.equal(deepGoogleReviews.contractLevel, 'degraded')
  assert.equal(deepGoogleReviews.automaticSelectionEligible, false)
  assert.equal(deepGoogleReviews.connectorId, 'dataforseo-google-public-reviews')
  assert.equal(deepGoogleReviews.probeDefinitionRef, 'repo:/probes/definitions/dataforseo-google-public-reviews-live.json')
  assert.equal(deepGoogleReviews.failureDomains.includes('target-content-rights'), true)
  const openConnector = catalog.routes.find((route) => route.id === 'public-social-openconnector-tikhub')
  assert.equal(openConnector.lifecycle, 'candidate')
  assert.equal(openConnector.contractLevel, 'component')
  assert.equal(openConnector.automaticSelectionEligible, false)
  assert.equal(openConnector.connectorId, 'openconnector-public-social-search')
  assert.equal(openConnector.probeDefinitionRef, 'repo:/probes/definitions/openconnector-public-social-search-live.json')
  assert.equal(openConnector.capabilityCoverage[0].phases.includes('cleanup'), true)
  const managedSocial = catalog.routes.find((route) => route.id === 'public-social-oomol-managed-research')
  assert.equal(managedSocial.lifecycle, 'researching')
  assert.equal(managedSocial.connectorId, undefined)
  assert.equal(managedSocial.automaticSelectionEligible, false)
})

test('Connector configuration schemas compile', async () => {
  for (const schemaPath of [
    '../connectors/xiaohongshu-browser/config.schema.json',
    '../connectors/xiaohongshu-account-docs/config.schema.json',
    '../connectors/xiaohongshu-community-rules-browser/config.schema.json',
    '../connectors/douyin-open-platform-docs/config.schema.json',
    '../connectors/douyin-public-video-embed/config.schema.json',
    '../connectors/tiktok-public-video-embed/config.schema.json',
    '../connectors/youtube-public-video-search/config.schema.json',
    '../connectors/hugging-face-public-model-revision/config.schema.json',
    '../connectors/arxiv-public-metadata-search/config.schema.json',
    '../connectors/apple-public-app-search/config.schema.json',
    '../connectors/github-public-repository-search/config.schema.json',
    '../connectors/github-public-repository-file/config.schema.json',
    '../connectors/github-public-repository-tags/config.schema.json',
    '../connectors/github-public-repository-release/config.schema.json',
    '../connectors/github-public-repository-work-item-changes/config.schema.json',
    '../connectors/evidence-backed-research-agent/config.schema.json',
    '../connectors/distribution-impact-observation-evaluator/config.schema.json',
    '../connectors/public-state-pet-behavior-projector/config.schema.json',
    '../connectors/memory-action-grounding/config.schema.json',
    '../connectors/versioned-memory-use-evaluator/config.schema.json',
    '../connectors/persona-continuity-evaluator/config.schema.json',
    '../connectors/multi-turn-response-repetition-observer/config.schema.json',
    '../connectors/bounded-work-context-projection/config.schema.json',
    '../connectors/current-work-projection-maintainer/config.schema.json',
    '../connectors/current-work-projection-reconciler/config.schema.json',
    '../connectors/action-impact-review-revision/config.schema.json',
    '../connectors/dataforseo-google-organic-serp/config.schema.json',
    '../connectors/dataforseo-google-public-reviews/config.schema.json',
    '../connectors/appfigures-public-app-reviews/config.schema.json',
    '../connectors/openconnector-public-social-search/config.schema.json',
    '../connectors/google-places-public-reviews/config.schema.json',
    '../connectors/coresignal-job-posting-snapshot/config.schema.json',
    '../connectors/steam-public-game-reviews/config.schema.json',
    '../connectors/local-game-build-revision/config.schema.json',
    '../connectors/steam-store-asset-revision/config.schema.json',
    '../connectors/steam-store-description-revision/config.schema.json',
    '../connectors/steam-supported-feature-revision/config.schema.json',
    '../connectors/steam-content-survey-revision/config.schema.json',
    '../connectors/steam-early-access-revision/config.schema.json',
    '../connectors/steam-initial-release-date-revision/config.schema.json',
    '../connectors/steam-initial-base-price-revision/config.schema.json',
    '../connectors/consented-feedback-intake-revision/config.schema.json',
    '../connectors/feedback-intake-local-store/config.schema.json',
    '../connectors/feedback-intake-local-withdrawal/config.schema.json',
    '../connectors/feedback-intake-local-retention-expiry/config.schema.json',
    '../connectors/feedback-observation-reconciler/config.schema.json',
    '../connectors/feedback-theme-synthesis-agent/config.schema.json',
  ]) {
    const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url), 'utf8'))
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    assert.doesNotThrow(() => ajv.compile(schema))
  }
})

test('GitHub live snapshot payload matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/search-public-repositories-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-search/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository file live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/read-public-repository-file-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-file/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository tags live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/list-public-repository-tags-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-tags/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository release live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/read-public-repository-release-by-tag-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-release/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('Douyin public video embed live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/douyin/read-public-video-embed-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/douyin/public-video-embed/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('TikTok public video embed live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/tiktok/read-public-video-embed-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/tiktok/public-video-embed/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(JSON.stringify(snapshot).includes('author_name'), false)
  assert.equal(JSON.stringify(snapshot).includes('<blockquote'), false)
})

test('Hugging Face public model revision live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/hugging-face/read-public-model-revision-manifest-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/hugging-face/public-model-revision/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('arXiv public metadata live snapshot is bounded and never claims a stable delta', async () => {
  const validate = await validator('../knowledge/schemas/arxiv/search-public-eprint-metadata-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/arxiv/public-metadata-search/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.entries.length <= 5, true)
  assert.equal(snapshot.coverage.metadataOnly, true)
  assert.equal(snapshot.coverage.contentFilesRetained, false)
  assert.equal(snapshot.coverage.checkpointSemantics, 'offset-is-not-stable-delta')
})

test('Apple public app search live snapshot is metadata-only and never claims rank or corpus size', async () => {
  const validate = await validator('../knowledge/schemas/research/search-public-app-catalog-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/apple/public-app-search/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.items.length <= 5, true)
  assert.equal(snapshot.items.some((item) => item.appId === '6448311069'), true)
  assert.equal(snapshot.coverage.metadataOnly, true)
  assert.equal(snapshot.coverage.corpusComplete, false)
  assert.equal(snapshot.coverage.rankingSemantics, 'apple-search-api-unspecified')
  assert.equal(snapshot.coverage.resultCountSemantics, 'returned-page-size-only')
  assert.equal(JSON.stringify(snapshot).includes('description'), false)
  assert.equal(JSON.stringify(snapshot).includes('artwork'), false)
})

test('GitHub public repository work-item change live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/list-public-repository-work-item-changes-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-work-item-changes/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('Evidence-backed research local snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('Evidence-backed platform-integration Agent observation matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/platform-integration-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'platform-integration')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /Appfigures/)
})

test('Evidence-backed Xianyu route observation rejects technical feasibility without platform permission', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'platform-integration')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.decision, /是否把无需闲鱼登录的付费关键词搜索 Actor 提升/)
  assert.match(snapshot.answer, /当前不能建立闲鱼自动关键词搜索 candidate Connector/)
  assert.match(snapshot.answer, /付费给供应商不能替代目标平台授权/)
})

test('Evidence-backed demand source route observation selects probes without inventing platform access', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'platform-integration')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /DataForSEO 候选/)
  assert.match(snapshot.answer, /不证明目标平台授权/)
  assert.match(snapshot.findings.find((finding) => finding.id === 'independent-jobs-route-is-next-candidate').claim, /不能声称 BOSS 覆盖/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'paid-access-is-not-platform-authorization'), true)
  assert.equal(snapshot.nextProbes.map((probe) => probe.effect).includes('platform-write'), false)
})

test('Evidence-backed assistant approval research keeps approval separate from execution', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'technical-solution')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /不能做一个接受 caller supplied approved=true 的纯函数/)
  assert.match(snapshot.answer, /CAS 消费后才调用工具/)
})

test('Evidence-backed assistant approval transport research rejects the current Web answerer route', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'technical-solution')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /暂停 Web answerer 路线/)
  assert.match(snapshot.answer, /不能证明人类批准/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'web-answerer-not-owner-bound'), true)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'durable-authorization-remains-separate'), true)
})

test('Evidence-backed personal assistant demand research ranks independent slices without prevalence claims', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'demand')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /turn-policy\/audio-event eval/)
  assert.match(snapshot.answer, /不证明市场频率/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'pet-state-already-sliced'), true)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'companionship-longitudinal'), true)
})

test('Evidence-backed academic frontier research selects a product-native memory eval without benchmark overclaim', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'academic-frontier')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /memory-use eval/)
  assert.match(snapshot.answer, /不能直接代表真实工作流/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'version-and-abstention-first'), true)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'memory-score-is-not-companionship'), true)
})

test('Evidence-backed distribution-impact research preserves native metrics and rejects causal overclaim', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/distribution-impact-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'distribution-impact')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /跨平台总分/)
  assert.match(snapshot.answer, /temporal association/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'missing-is-not-zero'), true)
  assert.equal(snapshot.nextProbes.every((probe) => probe.effect === 'none'), true)
})

test('Evidence-backed market-competitive research separates category signals, mechanisms and persona outcomes', async () => {
  const validate = await validator('../knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.scenario, 'market-competitive')
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(snapshot.coverage.requiredRoles.every((role) => snapshot.coverage.coveredRoles.includes(role)), true)
  assert.equal(snapshot.counterEvidenceSearch.outcome, 'found')
  assert.match(snapshot.answer, /不能.*市场规模|不能推出稳定市场|不是一个可直接计数的稳定市场/)
  assert.match(snapshot.answer, /persona continuity|四轴/)
  assert.match(snapshot.answer, /companion quality 总分/)
  assert.equal(snapshot.findings.some((finding) => finding.id === 'mechanism-is-not-continuity'), true)
  assert.equal(snapshot.nextProbes.every((probe) => probe.effect === 'none'), true)
})

test('Distribution impact observation evaluation preserves native uncertainty and has no effects', async () => {
  const validate = await validator('../knowledge/schemas/distribution/evaluate-impact-observation-set-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/distribution/impact-observation-evaluation/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.deepEqual(snapshot.summary, { total: 6, comparable: 3, pending: 1, unknown: 2, platformAttributed: 1, temporalAssociations: 1 })
  assert.equal(snapshot.comparisons.find((item) => item.comparisonRef === 'apple:downloads-suppressed').delta, null)
  assert.equal(snapshot.comparisons.find((item) => item.comparisonRef === 'play:definition-drift').status, 'definition-drift')
  assert.equal(snapshot.comparisons.find((item) => item.comparisonRef === 'steam:total-visits-temporal').reasons.includes('causality-not-established'), true)
  assert.equal(snapshot.noCrossPlatformScore, true)
  assert.equal(snapshot.causalClaimGenerated || snapshot.platformDataRead || snapshot.knowledgeWritten || snapshot.actionExecuted || snapshot.executionAuthorized, false)
})

test('Optifeed Radar live snapshot matches its public readiness contract', async () => {
  const validate = await validator('../knowledge/schemas/distribution/audit-store-ai-readiness-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/distribution/ai-readiness-audit/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.domain, 'optifeed.com')
  assert.equal(snapshot.categories.length, 5)
  assert.equal(snapshot.measurement.aiEngineCalls, false)
  assert.equal(snapshot.measurement.apiCost, 0)
  assert.equal(snapshot.measurement.recommendationVisibilityMeasured, false)
  assert.equal(snapshot.conformance.status, 'passed')
  assert.equal(/api[_-]?key|credential|token|radarRoot|\/Users\/|acceptedCommit/i.test(JSON.stringify(snapshot)), false)
})

test('Public-state pet behavior local snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/pet/project-public-state-to-behavior-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/pet/public-state-behavior/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.coverage.privateTextAccepted, false)
})

test('Duplex turn policy snapshot stays reversible before confirmed turn-take', async () => {
  const validate = await validator('../knowledge/schemas/voice/project-duplex-turn-events-to-actions-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/voice/duplex-turn-policy/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.coverage.rawAudioAccepted, false)
  assert.equal(snapshot.coverage.transcriptAccepted, false)
  assert.equal(snapshot.coverage.destructiveCancels, 1)
  assert.equal(snapshot.observations.find((item) => item.outcome === 'released').outputCancelled, false)
  assert.equal(snapshot.observations.find((item) => item.outcome === 'backchannel').outputCancelled, false)
})

test('Memory-action grounding local snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/assistant/ground-memory-into-action-candidate-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/memory-action-grounding/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.executionAuthorized, false)
  assert.equal(snapshot.bindings.filter((item) => item.source === 'memory').every((item) => item.claimIds.length > 0 && item.provenanceRefs.length > 0), true)
})

test('Bounded work context snapshot is ephemeral, scoped and non-executing', async () => {
  const validate = await validator('../knowledge/schemas/assistant/read-bounded-work-context-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/bounded-work-context/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, productionRevision: _productionRevision, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.retention, 'ephemeral-only')
  assert.equal(snapshot.coverage.currentWorkIncluded, true)
  assert.equal(snapshot.coverage.currentSessionTranscriptIncluded, false)
  assert.equal(snapshot.coverage.rawTranscriptRetained, false)
  assert.equal(snapshot.coverage.projectionComplete, false)
  assert.equal(snapshot.sourceRefs.includes('.pkb/current.md'), true)
  assert.equal(snapshot.sourceRefs.includes(snapshot.currentSessionRef), false)
  assert.equal(snapshot.sessionHistoryModified, false)
  assert.equal(snapshot.durableKnowledgeModified, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Current work maintenance snapshot proves local writes stop before durable knowledge', async () => {
  const validate = await validator('../knowledge/schemas/assistant/maintain-current-work-projection-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/current-work-projection-maintenance/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, productionRevision: _productionRevision, productionReceipt: _productionReceipt, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'updated')
  assert.equal(snapshot.currentProjectionModified, true)
  assert.equal(snapshot.currentSessionSourceIncluded, true)
  assert.equal(snapshot.checkpointAdvanced, true)
  assert.equal(snapshot.proposalRefs.length, 1)
  assert.equal(snapshot.coverage.rawSessionTextReturned, false)
  assert.equal(snapshot.coverage.currentProjectionComplete, false)
  assert.equal(snapshot.coverage.proposalsUnconfirmed, true)
  assert.equal(snapshot.productionReceipt.proposalApplied, false)
  assert.equal(snapshot.productionReceipt.durableKnowledgeWritten, false)
  assert.equal(snapshot.productionReceipt.gitHeadChanged, false)
  assert.equal(snapshot.productionReceipt.modelCalls, 1)
  assert.equal(snapshot.productionReceipt.replayStatus, 'no-new-session-text')
  assert.equal(snapshot.sessionHistoryModified, false)
  assert.equal(snapshot.durableKnowledgeModified, false)
  assert.equal(snapshot.gitCommitted, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Current work reconciliation snapshot proves bounded replay and interrupted-session recovery', async () => {
  const validate = await validator('../knowledge/schemas/assistant/reconcile-current-work-projection-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/current-work-projection-reconciliation/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, productionRevision: _productionRevision, productionReceipt: _productionReceipt, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'reconciled')
  assert.deepEqual(snapshot.reconciledSessionRefs, ['session:session-alpha', 'session:session-beta'])
  assert.deepEqual(snapshot.checkpointAdvancedSessionRefs, ['session:session-alpha', 'session:session-beta'])
  assert.equal(snapshot.currentProjectionModified, true)
  assert.equal(snapshot.checkpointsModified, true)
  assert.equal(snapshot.coverage.recentSessionLimit, 12)
  assert.equal(snapshot.coverage.sessionEnumerationComplete, false)
  assert.equal(snapshot.coverage.sourceFailuresFullyObservable, false)
  assert.equal(snapshot.coverage.fullProjectionRebuild, false)
  assert.equal(snapshot.coverage.cursorReset, false)
  assert.equal(snapshot.productionReceipt.replayStatus, 'no-observed-session-increments')
  assert.equal(snapshot.productionReceipt.replayModelCalls, 0)
  assert.equal(snapshot.productionReceipt.interruptedEarlierSessionCommitted, true)
  assert.equal(snapshot.productionReceipt.resumedSessionRef, 'session:session-beta')
  assert.equal(snapshot.sessionHistoryModified, false)
  assert.equal(snapshot.durableKnowledgeModified, false)
  assert.equal(snapshot.gitCommitted, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Action impact review snapshot binds exact scope and never grants authorization', async () => {
  const validate = await validator('../knowledge/schemas/assistant/prepare-action-impact-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/action-impact-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.reviewClass, 'high')
  assert.equal(snapshot.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.candidate.targetRefs.length > 0, true)
  assert.equal(snapshot.reviewerDecision, null)
  assert.equal(snapshot.authorizationGranted, false)
  assert.equal(snapshot.confirmationTokenIssued, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Durable memory review snapshot binds exact content and never writes knowledge', async () => {
  const validate = await validator('../knowledge/schemas/assistant/prepare-durable-memory-change-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/durable-memory-change-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, productionRevision: _productionRevision, productionReceipt: _productionReceipt, conflictObserved: _conflictObserved, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.match(snapshot.change.desiredContentDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(snapshot.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.productionReceipt.committed, true)
  assert.equal(snapshot.conflictObserved, true)
  assert.equal(snapshot.proposalCreated, false)
  assert.equal(snapshot.applied, false)
  assert.equal(snapshot.committed, false)
  assert.equal(snapshot.receiptIssued, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Proactive contact review snapshot binds policy state and never sends a notification', async () => {
  const validate = await validator('../knowledge/schemas/assistant/prepare-proactive-contact-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/proactive-contact-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'eligible-for-human-review')
  assert.match(snapshot.reviewRevisionHash, /^sha256:[0-9a-f]{64}$/)
  assert.deepEqual(snapshot.suppressionReasons, [])
  assert.equal(snapshot.reviewItems.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.reviewerDecision, null)
  assert.equal(snapshot.notificationSent, false)
  assert.equal(snapshot.messageCreated, false)
  assert.equal(snapshot.deliveryAttempted, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Steam public game reviews live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/steam/read-public-game-review-page-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/public-game-reviews/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.coverage.reviewTextRetention, 'redacted')
  assert.equal(snapshot.reviews.every((review) => review.text.retained === false && !Object.hasOwn(review.text, 'value')), true)
})

test('Steam review observation projection stays partial and cannot infer deletion', async () => {
  const validate = await validator('../knowledge/schemas/steam/project-review-page-to-observation-window-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/review-observation-projection/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.window.completeness, 'partial')
  assert.equal(snapshot.coverage.checkpointSemantics, 'resume-cursor-only-not-global-high-watermark')
  assert.equal(snapshot.coverage.absenceDeletionInferenceAllowed, false)
  assert.equal(snapshot.checkpointRecommendation.action, 'hold')
  assert.equal(snapshot.executionAuthorized, false)
})

test('Local game build revision snapshot matches its product output schema and never claims upload', async () => {
  const validate = await validator('../knowledge/schemas/game/prepare-local-build-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/game/local-build-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.uploaded, false)
  assert.equal(snapshot.executionAuthorized, false)
  assert.equal(snapshot.artifacts.every((artifact) => !artifact.path.startsWith('/') && /^sha256:[0-9a-f]{64}$/.test(artifact.sha256)), true)
})

test('Steam store asset revision snapshot matches its product schema and remains pending human review', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-store-asset-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/store-asset-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.manualReview.required, true)
  assert.equal(snapshot.manualReview.checks.every((check) => check.status === 'pending'), true)
  assert.equal(snapshot.assets.filter((asset) => asset.kind === 'screenshot').length, 5)
  assert.equal(snapshot.assets.every((asset) => !asset.path.startsWith('/') && /^sha256:[0-9a-f]{64}$/.test(asset.sha256)), true)
  assert.equal(snapshot.uploaded, false)
  assert.equal(snapshot.markedReadyForReview, false)
  assert.equal(snapshot.released, false)
  assert.equal(snapshot.executionAuthorized, false)
})

test('Steam store description revision snapshot binds localized copy and remains pending human review', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-store-description-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/store-description-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.deepEqual(snapshot.localizations.map((item) => item.language), ['english', 'schinese'])
  assert.equal(snapshot.localizations.every((item) => /^sha256:[0-9a-f]{64}$/.test(item.shortDescriptionDigest) && /^sha256:[0-9a-f]{64}$/.test(item.aboutThisGameDigest)), true)
  assert.equal(snapshot.manualReview.checks.every((check) => check.status === 'pending'), true)
  assert.equal(snapshot.uploaded || snapshot.published || snapshot.markedReadyForReview || snapshot.released || snapshot.executionAuthorized, false)
})

test('Steam store tag revision snapshot preserves ordered discovery metadata without platform authority', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-store-tag-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/store-tag-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.tags.length >= 5 && snapshot.tags.length <= 20, true)
  assert.deepEqual(snapshot.tags.slice(0, 5).map((item) => item.topFive), [true, true, true, true, true])
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformValidated || snapshot.savedToSteamworks || snapshot.published || snapshot.markedReadyForReview || snapshot.released || snapshot.executionAuthorized, false)
})

test('Steam system requirements revision binds exact platforms and remains pending human review', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-system-requirements-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/system-requirements-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.deepEqual(snapshot.platforms.map((item) => item.platform), ['windows', 'macos', 'linux-steamos'])
  assert.equal(snapshot.platforms.every((item) => item.minimum.length >= 5 && item.minimum.every((requirement) => /^sha256:[0-9a-f]{64}$/.test(requirement.valueDigest))), true)
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.savedToSteamworks || snapshot.previewedOnSteam || snapshot.published || snapshot.markedReadyForReview || snapshot.released || snapshot.executionAuthorized, false)
})

test('Steam supported-feature revision rejects future claims and remains non-executing', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-supported-feature-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/supported-feature-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.features.length, 5)
  assert.equal(snapshot.features.every((item) => item.implementationState === 'implemented-current-build' && item.implementationEvidenceRefs.length > 0 && item.testEvidenceRefs.length > 0), true)
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformValidated || snapshot.buildValidatedByConnector || snapshot.savedToSteamworks || snapshot.previewedOnSteam || snapshot.published || snapshot.markedReadyForReview || snapshot.released || snapshot.executionAuthorized, false)
})

test('Steam Content Survey revision binds a closed questionnaire without platform effects', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-content-survey-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/content-survey-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.deepEqual(snapshot.sections.map((item) => item.section), ['general-content', 'mature-content', 'generative-ai-content'])
  assert.equal(snapshot.sections.every((section) => section.expectedQuestionRefs.length === section.answers.length && section.answers.every((answer) => answer.evidenceRefs.length > 0 && answer.contentRefs.length > 0)), true)
  assert.equal(snapshot.declarations.allUploadedAdultContentDisclosed && snapshot.declarations.answersMatchCurrentBuildAndStorePage, true)
  assert.equal(snapshot.aiDisclosure.mode, 'both')
  assert.equal(snapshot.aiDisclosure.rightsEvidenceRefs.length > 0 && snapshot.aiDisclosure.guardrailEvidenceRefs.length > 0, true)
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformValidated || snapshot.buildValidatedByConnector || snapshot.submittedToSteamworks || snapshot.ratingIssued || snapshot.storefrontVisibilityChanged || snapshot.markedReadyForReview || snapshot.released || snapshot.executionAuthorized, false)
})

test('Steam Early Access revision binds current value separately from future plans', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-early-access-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/early-access-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.deepEqual(snapshot.answers.map((item) => item.questionRef), ['why-early-access', 'approximate-duration', 'planned-full-version-differences', 'current-early-access-state', 'pricing-during-and-after', 'community-involvement'])
  assert.equal(snapshot.currentBuild.playabilityState, 'playable-current-build')
  assert.equal(snapshot.currentBuild.playableEvidenceRefs.length > 0 && snapshot.currentBuild.gameplayTrailerEvidenceRefs.length > 0, true)
  assert.equal(snapshot.eligibility.fundingDependency, 'not-dependent-on-early-access-sales')
  assert.equal(snapshot.eligibility.futurePlanCommitment, 'non-binding-and-changeable')
  assert.equal(snapshot.pricePlan.steamPriceParity, 'confirmed-no-higher')
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformValidated || snapshot.buildValidatedByConnector || snapshot.priceValidated || snapshot.savedToSteamworks || snapshot.published || snapshot.markedReadyForReview || snapshot.releasedAsEarlyAccess || snapshot.executionAuthorized, false)
})

test('Steam initial base-price revision covers every current market without claiming platform validity', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-initial-base-price-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/initial-base-price-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.coverage.liveCurrencyCount, 37)
  assert.equal(snapshot.coverage.usdRegionGroupCount, 4)
  assert.equal(snapshot.coverage.expectedMarketCount, 41)
  assert.equal(snapshot.coverage.completeObservedMarketSet, true)
  assert.equal(snapshot.target.pricePoints.length, 41)
  assert.equal(snapshot.coverage.minimumThresholdsAuthenticated, false)
  assert.equal(snapshot.coverage.pricingCatalogAuthenticated, false)
  assert.equal(snapshot.coverage.discountsIncluded, false)
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformStateAuthenticated || snapshot.priceValidityConfirmed || snapshot.csvGenerated || snapshot.submittedToValve || snapshot.approvedByValve || snapshot.publishedToSteam || snapshot.discountConfigured || snapshot.executionAuthorized, false)
})

test('Steam initial release-date revision separates exact backend date from player display without platform effects', async () => {
  const validate = await validator('../knowledge/schemas/steam/prepare-initial-release-date-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/steam/initial-release-date-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.target.specifiedReleaseDate, '2026-10-30')
  assert.equal(snapshot.target.display.mode, 'month-year')
  assert.equal(snapshot.target.display.upcomingListPlacementDate, '2026-10-31')
  assert.equal(snapshot.timing.minimumComingSoonSatisfied, true)
  assert.equal(snapshot.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(snapshot.platformStateAuthenticated || snapshot.savedToSteamworks || snapshot.comingSoonChanged || snapshot.releaseButtonPressed || snapshot.released || snapshot.wishlistNotificationsTriggered || snapshot.executionAuthorized, false)
})

test('Consented feedback intake revision binds review evidence without claiming ingestion', async () => {
  const validate = await validator('../knowledge/schemas/feedback/prepare-consented-intake-review-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'ready-for-human-review')
  assert.equal(snapshot.submission.answers.every((item) => /^sha256:[0-9a-f]{64}$/.test(item.contentDigest)), true)
  assert.equal(snapshot.consent.noticeRevisionRef, snapshot.scope.noticeRevisionRef)
  assert.equal(snapshot.privacyReview.status, 'passed')
  assert.equal(snapshot.humanReviewRequired, true)
  assert.equal(snapshot.stored || snapshot.receiptIssued || snapshot.withdrawalApplied || snapshot.replySent || snapshot.knowledgeWritten || snapshot.executionAuthorized, false)
})

test('Feedback intake storage receipt proves only an exact authorized local write', async () => {
  const validate = await validator('../knowledge/schemas/feedback/persist-consented-intake-revision-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/intake-local-storage/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'stored')
  assert.equal(snapshot.stored, true)
  assert.match(snapshot.intakeRevisionHash, /^sha256:[0-9a-f]{64}$/)
  assert.match(snapshot.recordDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(snapshot.replayed, false)
  assert.equal(snapshot.withdrawalApplied || snapshot.replySent || snapshot.platformWritten || snapshot.knowledgeWritten || snapshot.executionAuthorized, false)
})

test('Feedback intake withdrawal receipt proves logical removal without sanitization overclaim', async () => {
  const validate = await validator('../knowledge/schemas/feedback/withdraw-consented-intake-record-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/intake-local-withdrawal/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'withdrawn')
  assert.equal(snapshot.recordPresent, false)
  assert.equal(snapshot.logicalDeletionApplied, true)
  assert.equal(snapshot.withdrawalApplied, true)
  assert.match(snapshot.recordDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(snapshot.mediaSanitized || snapshot.backupsPurged || snapshot.downstreamCopiesDeleted || snapshot.replySent || snapshot.platformWritten || snapshot.knowledgeWritten || snapshot.executionAuthorized, false)
})

test('Feedback intake retention deletion receipt proves only due-policy logical removal', async () => {
  const validate = await validator('../knowledge/schemas/feedback/expire-consented-intake-record-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/intake-local-retention-expiry/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'expired-and-deleted')
  assert.equal(snapshot.recordPresent, false)
  assert.equal(snapshot.retentionDeletionApplied, true)
  assert.match(snapshot.recordDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(snapshot.withdrawalApplied || snapshot.mediaSanitized || snapshot.backupsPurged || snapshot.downstreamCopiesDeleted || snapshot.replySent || snapshot.platformWritten || snapshot.knowledgeWritten || snapshot.executionAuthorized, false)
})

test('Feedback observation reconciliation snapshot preserves missing uncertainty and excludes execution', async () => {
  const validate = await validator('../knowledge/schemas/feedback/reconcile-feedback-observations-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/observation-reconciliation/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.executionAuthorized, false)
  assert.equal(snapshot.deletionInferencePolicy, 'explicit-lifecycle-only')
  assert.equal(snapshot.missingUnresolved.every((item) => item.deletionInferred === false), true)
})

test('Versioned memory-use evaluation snapshot is stage-separated and effect-free', async () => {
  const validate = await validator('../knowledge/schemas/assistant/evaluate-versioned-memory-use-suite-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/versioned-memory-use-evaluation/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.status, 'passed')
  assert.equal(snapshot.cases.length, 10)
  assert.equal(snapshot.cases.every((item) => item.stages.length === 5 && item.stages.every((stage) => stage.status === 'passed')), true)
  assert.equal(snapshot.cases.every((item) => /^sha256:[0-9a-f]{64}$/.test(item.resultDigest)), true)
  assert.equal(snapshot.memoryChanged || snapshot.knowledgeWritten || snapshot.actionExecuted || snapshot.executionAuthorized, false)
})

test('Persona continuity evaluation snapshot separates axes, system truth and evaluator disagreement', async () => {
  const validate = await validator('../knowledge/schemas/assistant/evaluate-persona-continuity-suite-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/assistant/persona-continuity-evaluation/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.deepEqual(snapshot.summary.cases, { total: 7, held: 2, deviated: 3, disagreement: 1, unknown: 1, 'not-applicable': 0 })
  assert.equal(snapshot.cases.find((item) => item.caseRef === 'emotional-vulnerability').axes.find((axis) => axis.axis === 'style').status, 'disagreement')
  assert.equal(snapshot.cases.find((item) => item.caseRef === 'system-state-conflict').systemTruth.status, 'deviated')
  assert.equal(snapshot.noCompositeScore && snapshot.humanReviewRequired && !snapshot.evaluatorIndependenceClaimed, true)
  assert.equal(snapshot.personaChanged || snapshot.memoryChanged || snapshot.platformDataRead || snapshot.actionExecuted || snapshot.executionAuthorized, false)
})

test('Feedback theme synthesis snapshot is evidence-linked, sample-only and review-required', async () => {
  const validate = await validator('../knowledge/schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/feedback/theme-synthesis/snapshot.json', import.meta.url), 'utf8'))
  const { fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
  assert.equal(snapshot.humanReviewRequired, true)
  assert.equal(snapshot.executionAuthorized, false)
  assert.equal(snapshot.themes.every((theme) => theme.frequency.interpretation === 'sample-only' && theme.supportEvidenceRefs.length > 0), true)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamSupportedFeatureReviewRevision } from '../src/index.mjs'

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'design:launch-v4',
  buildRevisionRef: 'build:steam-public-candidate-v7',
  featureCatalogRevisionRef: 'steam-features:observed-2026-08-27',
  features: [
    ['single-player', 'Single-player'], ['steam-achievements', 'Steam Achievements'], ['full-controller-support', 'Full controller support'], ['steam-cloud', 'Steam Cloud'], ['family-sharing', 'Family Sharing'],
  ].map(([id, displayName]) => ({ featureRef: `steam-feature:${id}`, displayName, implementationState: 'implemented-current-build', implementationEvidenceRefs: [`build-proof:${id}`], testEvidenceRefs: [`test:${id}`] })),
}

test('freezes current-build supported features into a deterministic human-review revision', () => {
  const result = prepareSteamSupportedFeatureReviewRevision(input, { now: () => new Date('2026-08-27T00:00:00Z') })
  const replay = prepareSteamSupportedFeatureReviewRevision(input, { now: () => new Date('2026-08-28T00:00:00Z') })
  assert.equal(result.status, 'ready-for-human-review')
  assert.equal(result.revisionHash, replay.revisionHash)
  assert.deepEqual(result.features.map((item) => item.featureRef), [...result.features.map((item) => item.featureRef)].sort())
  assert.equal(result.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(result.platformValidated || result.buildValidatedByConnector || result.savedToSteamworks || result.previewedOnSteam || result.published || result.markedReadyForReview || result.released || result.executionAuthorized, false)
})

test('binds build, catalog, feature identity, implementation and test evidence', () => {
  const base = prepareSteamSupportedFeatureReviewRevision(input).revisionHash
  const cases = []
  cases.push({ ...input, buildRevisionRef: 'build:steam-public-candidate-v8' })
  cases.push({ ...input, featureCatalogRevisionRef: 'steam-features:observed-next' })
  const renamed = structuredClone(input); renamed.features[0].displayName = 'Single Player'; cases.push(renamed)
  const implementation = structuredClone(input); implementation.features[0].implementationEvidenceRefs.push('build-proof:single-player-v2'); cases.push(implementation)
  const testEvidence = structuredClone(input); testEvidence.features[0].testEvidenceRefs.push('test:single-player-v2'); cases.push(testEvidence)
  for (const candidate of cases) assert.notEqual(prepareSteamSupportedFeatureReviewRevision(candidate).revisionHash, base)
})

test('blocks planned, unknown and duplicate feature declarations', () => {
  const planned = structuredClone(input); planned.features[0].implementationState = 'planned-not-released'
  assert.equal(prepareSteamSupportedFeatureReviewRevision(planned).preflight.blockers.some((item) => item.code === 'planned-feature-cannot-be-selected'), true)
  const unknown = structuredClone(input); unknown.features[0].implementationState = 'unknown'
  assert.equal(prepareSteamSupportedFeatureReviewRevision(unknown).preflight.blockers.some((item) => item.code === 'feature-implementation-unknown'), true)
  const duplicateRef = structuredClone(input); duplicateRef.features[1].featureRef = duplicateRef.features[0].featureRef
  assert.equal(prepareSteamSupportedFeatureReviewRevision(duplicateRef).preflight.blockers.some((item) => item.code === 'duplicate-feature-ref'), true)
  const duplicateName = structuredClone(input); duplicateName.features[1].displayName = 'single-player'
  assert.equal(prepareSteamSupportedFeatureReviewRevision(duplicateName).preflight.blockers.some((item) => item.code === 'duplicate-feature-name'), true)
})

test('rejects hidden authority, empty evidence and unsafe display content', () => {
  assert.throws(() => prepareSteamSupportedFeatureReviewRevision({ ...input, approved: true }), /unsupported fields/)
  const secret = structuredClone(input); secret.features[0].platformResponse = 'secret'
  assert.throws(() => prepareSteamSupportedFeatureReviewRevision(secret), /unsupported fields/)
  const missingTest = structuredClone(input); missingTest.features[0].testEvidenceRefs = []
  assert.throws(() => prepareSteamSupportedFeatureReviewRevision(missingTest), /must contain 1/)
  const newline = structuredClone(input); newline.features[0].displayName = 'Single\nplayer'
  assert.throws(() => prepareSteamSupportedFeatureReviewRevision(newline), /control/)
})

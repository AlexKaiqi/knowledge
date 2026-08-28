import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamSystemRequirementsReviewRevision } from '../src/index.mjs'

const fields = (suffix = '') => [
  { field: 'os', value: `Windows 10 64-bit${suffix}`, evidenceRefs: ['evidence:os'] },
  { field: 'processor', value: `Quad-core 3.0 GHz${suffix}`, evidenceRefs: ['evidence:cpu'] },
  { field: 'memory', value: `8 GB RAM${suffix}`, evidenceRefs: ['evidence:memory'] },
  { field: 'graphics', value: `DirectX 11 compatible GPU${suffix}`, evidenceRefs: ['evidence:gpu'] },
  { field: 'storage', value: `4 GB available space${suffix}`, evidenceRefs: ['evidence:storage'] },
]

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'revision:requirements-copy-v1',
  buildRevisionRef: 'revision:owned-build-v1',
  platforms: [{
    platform: 'windows',
    buildArtifactRef: 'artifact:windows-build-v1',
    depotRefs: ['steam-depot:windows'],
    publicPackageRefs: ['steam-package:base-game'],
    launchTestRefs: ['test:windows-minimum-launch'],
    minimum: fields(),
    recommended: fields(' recommended'),
  }],
}

test('freezes a deterministic exact-platform human-review revision without platform authority', () => {
  const options = { now: () => new Date('2026-08-27T07:00:00Z') }
  const first = prepareSteamSystemRequirementsReviewRevision(input, options)
  const second = prepareSteamSystemRequirementsReviewRevision(input, options)
  assert.equal(first.status, 'ready-for-human-review')
  assert.equal(first.revisionHash, second.revisionHash)
  assert.equal(first.platforms[0].minimum.length, 5)
  assert.equal(first.platforms[0].recommended.length, 5)
  assert.equal(first.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(first.savedToSteamworks, false)
  assert.equal(first.previewedOnSteam, false)
  assert.equal(first.published, false)
  assert.equal(first.markedReadyForReview, false)
  assert.equal(first.released, false)
  assert.equal(first.executionAuthorized, false)
})

test('requirements, build, depot, package, tests and evidence all invalidate the revision', () => {
  const base = prepareSteamSystemRequirementsReviewRevision(input).revisionHash
  const mutations = [
    { ...input, buildRevisionRef: 'revision:owned-build-v2' },
    { ...input, platforms: [{ ...input.platforms[0], depotRefs: ['steam-depot:windows-v2'] }] },
    { ...input, platforms: [{ ...input.platforms[0], publicPackageRefs: ['steam-package:new'] }] },
    { ...input, platforms: [{ ...input.platforms[0], launchTestRefs: ['test:windows-v2'] }] },
    { ...input, platforms: [{ ...input.platforms[0], minimum: input.platforms[0].minimum.map((item) => item.field === 'memory' ? { ...item, value: '16 GB RAM' } : item) }] },
    { ...input, platforms: [{ ...input.platforms[0], minimum: input.platforms[0].minimum.map((item) => item.field === 'memory' ? { ...item, evidenceRefs: ['evidence:memory-v2'] } : item) }] },
  ]
  for (const mutation of mutations) assert.notEqual(prepareSteamSystemRequirementsReviewRevision(mutation).revisionHash, base)
})

test('blocks incomplete minimum, partial recommended and non-Windows DirectX', () => {
  const missing = { ...input, platforms: [{ ...input.platforms[0], minimum: fields().filter((item) => item.field !== 'storage') }] }
  assert.equal(prepareSteamSystemRequirementsReviewRevision(missing).preflight.blockers[0].code, 'minimum-core-fields-missing')
  const partialRecommended = { ...input, platforms: [{ ...input.platforms[0], recommended: fields().slice(0, 2) }] }
  assert.equal(prepareSteamSystemRequirementsReviewRevision(partialRecommended).preflight.blockers[0].code, 'recommended-core-fields-missing')
  const linux = { ...input, platforms: [{ ...input.platforms[0], platform: 'linux-steamos', minimum: [...fields().map((item) => item.field === 'os' ? { ...item, value: 'Ubuntu 22.04' } : item), { field: 'directx', value: 'Version 11', evidenceRefs: ['evidence:directx'] }], recommended: [] }] }
  assert.equal(prepareSteamSystemRequirementsReviewRevision(linux).preflight.blockers.some((item) => item.code === 'directx-only-valid-for-windows'), true)
})

test('rejects duplicate platforms or fields, markup, hidden authority and unsafe shapes', () => {
  assert.throws(() => prepareSteamSystemRequirementsReviewRevision({ ...input, platforms: [input.platforms[0], input.platforms[0]] }), /platforms must be unique/)
  assert.throws(() => prepareSteamSystemRequirementsReviewRevision({ ...input, platforms: [{ ...input.platforms[0], minimum: [...fields(), fields()[0]] }] }), /fields must be unique/)
  assert.throws(() => prepareSteamSystemRequirementsReviewRevision({ ...input, platforms: [{ ...input.platforms[0], minimum: fields().map((item) => item.field === 'os' ? { ...item, value: '<b>Windows</b>' } : item) }] }), /plain single-line/)
  assert.throws(() => prepareSteamSystemRequirementsReviewRevision({ ...input, publish: true }), /unsupported fields/)
  assert.throws(() => prepareSteamSystemRequirementsReviewRevision({ ...input, platforms: [{ ...input.platforms[0], appId: 123 }] }), /unsupported fields/)
})

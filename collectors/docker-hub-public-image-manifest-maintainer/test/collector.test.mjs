import assert from 'node:assert/strict'
import test from 'node:test'
import { DockerHubPublicImageManifestError } from '../../../connectors/docker-hub-public-image-manifest/src/index.mjs'
import { collectDockerHubPublicImageManifestMaintenance, FIXTURE_INPUT } from '../src/index.mjs'

const projects = [
  {
    id: 'spec', repository: 'https://github.com/example/spec.git', branch: 'main', observedRevision: 'a'.repeat(40),
    watch: { lastReviewedAt: '2026-08-20T00:00:00Z', reviewCadenceDays: 30 },
  },
]
const projectCatalog = { projects }
const manifest = {
  repository: FIXTURE_INPUT.repository,
  digest: FIXTURE_INPUT.manifestDigest,
  kind: 'image-index', schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json',
  bodySizeBytes: 9218, descriptorCount: 16, declaredReferencedBytes: 14614,
  descriptorSetDigest: 'b'.repeat(64), descriptors: [],
}
const current = { manifest, conformance: { status: 'passed', assertions: [] } }
const acceptedState = {
  snapshot: current,
  report: { expiresAt: '2026-09-02T00:00:00.000Z' },
}
const now = () => new Date('2026-08-27T00:00:00.000Z')

test('stays current when the exact manifest, upstream HEADs, and verification remain current', async () => {
  const result = await collectDockerHubPublicImageManifestMaintenance({ now, reader: async () => current, projectHead: async () => 'a'.repeat(40), acceptedState, projectCatalog })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
  assert.equal(result.projects[0].status, 'current')
})

test('proposes review for manifest semantic drift and upstream project changes without updating either baseline', async () => {
  const changed = { ...current, manifest: { ...manifest, descriptorSetDigest: 'c'.repeat(64) } }
  const result = await collectDockerHubPublicImageManifestMaintenance({ now, reader: async () => changed, projectHead: async () => 'd'.repeat(40), acceptedState, projectCatalog })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-upstream-project-change', 'review-docker-hub-manifest-change'])
  assert.equal(projects[0].observedRevision, 'a'.repeat(40))
})

test('requests a fresh probe after verification expiry and a scheduled project review after cadence', async () => {
  const staleCatalog = { projects: [{ ...projects[0], watch: { lastReviewedAt: '2026-07-01T00:00:00Z', reviewCadenceDays: 7 } }] }
  const result = await collectDockerHubPublicImageManifestMaintenance({
    now,
    reader: async () => current,
    projectHead: async () => 'a'.repeat(40),
    acceptedState: { ...acceptedState, report: { expiresAt: '2026-08-26T23:59:59.000Z' } },
    projectCatalog: staleCatalog,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['scheduled-upstream-project-review', 'rerun-live-probe'])
})

test('separates pull-budget deferral, fixture removal, and connector failure without retrying', async () => {
  for (const [code, status, action] of [
    ['rate-limited', 'deferred', 'rerun-after-pull-budget-recovers'],
    ['access-policy-blocked', 'deferred', 'review-docker-hub-access-policy'],
    ['not-found', 'review-required', 'replace-or-review-docker-hub-manifest-fixture'],
  ]) {
    let calls = 0
    const result = await collectDockerHubPublicImageManifestMaintenance({
      now,
      reader: async () => { calls += 1; throw new DockerHubPublicImageManifestError(code, { code }) },
      projectHead: async () => 'a'.repeat(40),
      acceptedState,
      projectCatalog,
    })
    assert.equal(result.status, status)
    assert.equal(result.proposals.at(-1).action, action)
    assert.equal(calls, 1)
  }
  const failed = await collectDockerHubPublicImageManifestMaintenance({ now, reader: async () => { throw new Error('shape drift') }, projectHead: async () => 'a'.repeat(40), acceptedState, projectCatalog })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals.at(-1).action, 'restore-docker-hub-manifest-access')
})

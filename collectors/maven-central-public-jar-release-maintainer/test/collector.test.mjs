import assert from 'node:assert/strict'
import test from 'node:test'
import { MavenCentralPublicJarReleaseError } from '../../../connectors/maven-central-public-jar-release/src/index.mjs'
import { collectMavenCentralPublicJarReleaseMaintenance, FIXTURE_INPUT } from '../src/index.mjs'

const sourceWatchList = { sources: [{ id: 'requirements', observation: { assertions: [] } }] }
const projectCatalog = { projects: [{ id: 'maven', repository: 'https://github.com/apache/maven.git', branch: 'master', observedRevision: 'a'.repeat(40), watch: { lastReviewedAt: '2026-08-20T00:00:00Z', reviewCadenceDays: 30 } }] }
const files = [
  { role: 'pom', fileName: 'junit-4.13.2.pom', url: 'https://repo.maven.apache.org/pom', sizeBytes: 27018, sha1: '1'.repeat(40), sha256: '1'.repeat(64), checksumSource: 'central-sidecar-verified' },
  { role: 'jar', fileName: 'junit-4.13.2.jar', url: 'https://repo.maven.apache.org/jar', sizeBytes: 384581, sha1: '2'.repeat(40), sha256: '2'.repeat(64), checksumSource: 'central-sidecar-verified' },
  { role: 'jar-signature', fileName: 'junit-4.13.2.jar.asc', url: 'https://repo.maven.apache.org/asc', sizeBytes: 833, sha1: '3'.repeat(40), sha256: '3'.repeat(64), checksumSource: 'local-only' },
]
const release = { gav: 'junit:junit:4.13.2', packaging: 'jar', repositoryPath: 'junit/junit/4.13.2', pomModelVersion: '4.0.0', pomCoordinatesVerified: true, fileCount: 3, totalPayloadBytes: 412432, files, signaturePresent: true, signatureCryptographicallyVerified: false }
const current = { request: FIXTURE_INPUT, release, conformance: { status: 'passed', assertions: [] } }
const acceptedState = { snapshot: current, report: { expiresAt: '2026-09-02T00:00:00.000Z' } }
const now = () => new Date('2026-08-27T00:00:00.000Z')
const sourceCheck = async () => ({ id: 'requirements', status: 'current', assertions: [] })
const projectHead = async () => 'a'.repeat(40)

test('stays current when source semantics, project HEAD, exact bytes, and verification remain current', async () => {
  const result = await collectMavenCentralPublicJarReleaseMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes independent reviews for official source, project, and artifact drift', async () => {
  const changed = { ...current, release: { ...release, files: [{ ...files[0], sha256: '4'.repeat(64) }, ...files.slice(1)] } }
  const result = await collectMavenCentralPublicJarReleaseMaintenance({
    now,
    reader: async () => changed,
    sourceCheck: async () => ({ id: 'requirements', status: 'review-required' }),
    projectHead: async () => 'b'.repeat(40),
    acceptedState,
    sourceWatchList,
    projectCatalog,
  })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['review-official-source-semantic-change', 'review-upstream-project-change', 'review-maven-central-release-change'])
})

test('requests scheduled source review and fresh verification without mutating baselines', async () => {
  const staleCatalog = { projects: [{ ...projectCatalog.projects[0], watch: { lastReviewedAt: '2026-07-01T00:00:00Z', reviewCadenceDays: 7 } }] }
  const result = await collectMavenCentralPublicJarReleaseMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState: { ...acceptedState, report: { expiresAt: '2026-08-26T23:59:59.000Z' } }, sourceWatchList, projectCatalog: staleCatalog })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['scheduled-upstream-project-review', 'rerun-live-probe'])
})

test('separates rate/access deferral, fixture removal, and implementation failure without retrying', async () => {
  for (const [code, status, action] of [
    ['rate-limited', 'deferred', 'rerun-after-rate-limit'],
    ['access-policy-blocked', 'deferred', 'review-maven-central-access-policy'],
    ['not-found', 'review-required', 'replace-or-review-maven-central-fixture'],
  ]) {
    let calls = 0
    const result = await collectMavenCentralPublicJarReleaseMaintenance({
      now, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog,
      reader: async () => { calls += 1; throw new MavenCentralPublicJarReleaseError(code, { code, phase: 'JAR' }) },
    })
    assert.equal(result.status, status)
    assert.equal(result.proposals.at(-1).action, action)
    assert.equal(calls, 1)
  }
  const failed = await collectMavenCentralPublicJarReleaseMaintenance({ now, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog, reader: async () => { throw new Error('checksum drift') } })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals.at(-1).action, 'restore-maven-central-release-access')
})

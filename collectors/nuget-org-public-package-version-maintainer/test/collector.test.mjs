import assert from 'node:assert/strict'
import test from 'node:test'
import { NuGetOrgPublicPackageVersionError } from '../../../connectors/nuget-org-public-package-version/src/index.mjs'
import { collectNuGetOrgPublicPackageVersionMaintenance, FIXTURE_INPUT } from '../src/index.mjs'

const packageVersion = {
  id: 'Newtonsoft.Json', version: '13.0.3', listed: true, publishedAt: '2023-03-08T07:42:54Z', prerelease: false, minClientVersion: '2.12',
  license: { expression: 'MIT', url: null, requiresAcceptance: false }, projectUrl: null,
  deprecation: { deprecated: false, reasons: [], alternatePackage: null },
  vulnerabilities: { total: 0, bySeverity: { low: 0, moderate: 0, high: 0, critical: 0 } },
  artifact: { fileName: 'newtonsoft.json.13.0.3.nupkg', sizeBytes: 1, sha256: 'a'.repeat(64), sha512: 'b'.repeat(128), signaturePresent: true, signatureCryptographicallyVerified: false },
}
const current = { packageVersion, conformance: { status: 'passed', assertions: [] } }
const sourceWatchList = { sources: [{ id: 'source', observation: { assertions: [] } }] }
const projectCatalog = { projects: [{ id: 'project', repository: 'https://example.invalid/repo.git', branch: 'main', observedRevision: 'c'.repeat(40), watch: { lastReviewedAt: '2026-08-26T00:00:00Z', reviewCadenceDays: 7 } }] }

function options(overrides = {}) {
  return {
    now: () => new Date('2026-08-27T00:00:00Z'),
    reader: async (input) => { assert.deepEqual(input, FIXTURE_INPUT); return current },
    sourceCheck: async (source) => ({ id: source.id, status: 'current', assertions: [] }),
    projectHead: async () => 'c'.repeat(40),
    acceptedState: { snapshot: current, report: { expiresAt: '2026-09-02T00:00:00Z' } },
    sourceWatchList,
    projectCatalog,
    ...overrides,
  }
}

test('returns current when package evidence, sources, projects and report are current', async () => {
  const result = await collectNuGetOrgPublicPackageVersionMaintenance(options())
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review for artifact drift and upstream changes without applying them', async () => {
  const changed = { ...current, packageVersion: { ...packageVersion, artifact: { ...packageVersion.artifact, sha256: 'd'.repeat(64) } } }
  const result = await collectNuGetOrgPublicPackageVersionMaintenance(options({ reader: async () => changed, projectHead: async () => 'e'.repeat(40) }))
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-nuget-org-package-change'), true)
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-upstream-project-change'), true)
})

test('turns semantic source drift and expired verification into proposals', async () => {
  const result = await collectNuGetOrgPublicPackageVersionMaintenance(options({
    sourceCheck: async (source) => ({ id: source.id, status: 'review-required', assertions: [{ id: 'contract', passed: false }] }),
    acceptedState: { snapshot: current, report: { expiresAt: '2026-08-26T00:00:00Z' } },
  }))
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-official-source-semantic-change'), true)
  assert.equal(result.proposals.some((proposal) => proposal.action === 'rerun-live-probe'), true)
})

test('defers typed rate limit and reviews a missing fixture', async () => {
  const rateLimited = await collectNuGetOrgPublicPackageVersionMaintenance(options({
    projectCatalog: { projects: [] },
    reader: async () => { throw new NuGetOrgPublicPackageVersionError('limited', { code: 'rate-limited', phase: 'package-content', retryAfter: '60' }) },
  }))
  assert.equal(rateLimited.status, 'deferred')
  assert.equal(rateLimited.proposals.some((proposal) => proposal.action === 'rerun-after-rate-limit' && proposal.retryAfter === '60'), true)
  const missing = await collectNuGetOrgPublicPackageVersionMaintenance(options({
    reader: async () => { throw new NuGetOrgPublicPackageVersionError('missing', { code: 'not-found', phase: 'registration-leaf' }) },
  }))
  assert.equal(missing.status, 'review-required')
  assert.equal(missing.proposals.some((proposal) => proposal.action === 'replace-or-review-nuget-org-fixture'), true)
})

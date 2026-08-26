import assert from 'node:assert/strict'
import test from 'node:test'
import { collectGitHubPublicRepositoryReleaseMaintenance } from '../src/index.mjs'
import { GitHubPublicRepositoryReleaseError } from '../../../connectors/github-public-repository-release/src/index.mjs'

const stableResult = {
  release: {
    tagName: '2.7',
    targetCommitish: 'master',
    name: 'XHS-Downloader V2.7',
    prerelease: false,
    immutable: false,
    createdAt: '2026-02-09T06:35:57.000Z',
    publishedAt: '2026-02-09T06:40:22.000Z',
    url: 'https://github.com/JoeanAmier/XHS-Downloader/releases/tag/2.7',
    notes: { sha256: 'a'.repeat(64) },
    assetCoverage: { representation: 'embedded-release-assets', returnedCount: 1, maximumAssets: 64, completeness: 'not-asserted', sha256Count: 1 },
    assets: [{ name: 'file.zip', sha256: 'b'.repeat(64), sizeBytes: 42 }],
  },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when normalized release evidence and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectGitHubPublicRepositoryReleaseMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when release notes or assets change', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, release: { ...stableResult.release, notes: { sha256: 'c'.repeat(64) } } }
  const result = await collectGitHubPublicRepositoryReleaseMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'review-github-release-change')
})

test('defers rate limits and reviews a missing accepted release without retrying', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  let calls = 0
  const limited = async () => {
    calls += 1
    throw new GitHubPublicRepositoryReleaseError('limited', { code: 'rate-limited', httpStatus: 403, retryAt: '2026-08-27T00:02:00.000Z' })
  }
  const deferred = await collectGitHubPublicRepositoryReleaseMaintenance({ reader: limited, acceptedState })
  assert.equal(deferred.status, 'deferred')
  assert.equal(deferred.proposals[0].notBefore, '2026-08-27T00:02:00.000Z')
  const missing = await collectGitHubPublicRepositoryReleaseMaintenance({ reader: async () => {
    calls += 1
    throw new GitHubPublicRepositoryReleaseError('missing', { code: 'release-not-found', httpStatus: 404 })
  }, acceptedState })
  assert.equal(missing.status, 'review-required')
  assert.equal(missing.proposals[0].action, 'review-github-release-removed-or-retagged')
  assert.equal(calls, 2)
})

test('turns other failures into one connector proposal without retrying', async () => {
  let calls = 0
  const result = await collectGitHubPublicRepositoryReleaseMaintenance({ reader: async () => { calls += 1; throw new Error('HTTP_503') }, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-github-release-access')
  assert.equal(calls, 1)
})

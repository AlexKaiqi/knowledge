import assert from 'node:assert/strict'
import test from 'node:test'
import { collectGitHubRepositoryFileMaintenance } from '../src/index.mjs'
import { GitHubPublicRepositoryFileError } from '../../../connectors/github-public-repository-file/src/index.mjs'

const stableResult = {
  request: { repository: 'octocat/Hello-World', path: 'README', revision: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d' },
  file: { gitBlobId: '980a0d5f19a64b4b30a87d4206aade58726b60e3', sizeBytes: 13, contentSha256: '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340' },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when immutable fixture integrity and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectGitHubRepositoryFileMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when an immutable fixture changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, file: { ...stableResult.file, contentSha256: 'a'.repeat(64) } }
  const result = await collectGitHubRepositoryFileMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-immutable-file-integrity-change'), true)
})

test('defers an exhausted GitHub core budget without claiming connector drift or retrying', async () => {
  let calls = 0
  const reader = async () => {
    calls += 1
    throw new GitHubPublicRepositoryFileError('HTTP_403', { code: 'rate-limited', httpStatus: 403, rateLimitRemaining: 0, rateLimitResetAt: '2026-08-27T01:00:00.000Z' })
  }
  const result = await collectGitHubRepositoryFileMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'deferred')
  assert.equal(result.proposals[0].action, 'rerun-after-rate-limit-reset')
  assert.equal(result.proposals[0].notBefore, '2026-08-27T01:00:00.000Z')
  assert.equal(calls, 1)
})

test('turns non-rate-limit access failures into one connector proposal without retrying', async () => {
  let calls = 0
  const reader = async () => { calls += 1; throw new Error('HTTP_503') }
  const result = await collectGitHubRepositoryFileMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-github-file-access')
  assert.equal(calls, 1)
})

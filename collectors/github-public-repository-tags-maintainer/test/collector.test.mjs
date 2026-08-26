import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubPublicRepositoryTagsError } from '../../../connectors/github-public-repository-tags/src/index.mjs'
import { collectGitHubPublicRepositoryTagsMaintenance } from '../src/index.mjs'

const stableResult = {
  repositoryUrl: 'https://github.com/tamnd/xiaohongshu-cli',
  coverage: { tagSetComplete: true },
  tags: [
    { name: 'v0.1.0', commitSha: '1508229cfa4b1437e0cb2e76b03dbfda42b23b4f' },
    { name: 'v0.2.0', commitSha: '96743ceff24452073b3571c1b07f6ce75bb223bb' },
  ],
  tagSetDigest: 'a'.repeat(64),
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when the complete tag set and verification remain current', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectGitHubPublicRepositoryTagsMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when the accepted tag set changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, tags: [...stableResult.tags, { name: 'v0.3.0', commitSha: '3'.repeat(40) }], tagSetDigest: 'b'.repeat(64) }
  const result = await collectGitHubPublicRepositoryTagsMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-github-repository-tag-set-change'), true)
})

test('does not treat a truncated fixture as complete evidence', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  const current = { ...stableResult, coverage: { tagSetComplete: false } }
  const result = await collectGitHubPublicRepositoryTagsMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.proposals.some((proposal) => proposal.action === 'replace-or-expand-tag-fixture'), true)
})

test('turns access failures into one connector proposal without retrying', async () => {
  let calls = 0
  const result = await collectGitHubPublicRepositoryTagsMaintenance({
    reader: async () => { calls += 1; throw new Error('HTTP_503') },
    acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } },
  })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-github-repository-tags-access')
  assert.equal(calls, 1)
})

test('defers core rate limiting without claiming connector drift', async () => {
  let calls = 0
  const result = await collectGitHubPublicRepositoryTagsMaintenance({
    reader: async () => {
      calls += 1
      throw new GitHubPublicRepositoryTagsError('HTTP_403', { code: 'rate-limited', httpStatus: 403, retryAt: '2026-08-27T00:02:00.000Z' })
    },
    acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } },
  })
  assert.equal(result.status, 'deferred')
  assert.equal(result.proposals[0].action, 'rerun-after-rate-limit-reset')
  assert.equal(result.proposals[0].notBefore, '2026-08-27T00:02:00.000Z')
  assert.equal(calls, 1)
})

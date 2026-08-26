import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubPublicRepositoryWorkItemChangesError } from '../../../connectors/github-public-repository-work-item-changes/src/index.mjs'
import { collectGitHubWorkItemChangesMaintenance, FIXTURE_INPUT, FIXTURE_NUMBER } from '../src/index.mjs'

const sourceWatchList = { sources: [{ id: 'issues', observation: { assertions: [] } }] }
const projectCatalog = { projects: [{ id: 'openapi', repository: 'https://github.com/example/openapi.git', branch: 'main', observedRevision: 'a'.repeat(40), watch: { lastReviewedAt: '2026-08-20T00:00:00Z', reviewCadenceDays: 30 } }] }
const current = {
  request: FIXTURE_INPUT,
  coverage: { complete: true, truncationReason: null },
  items: [{ number: FIXTURE_NUMBER, kind: 'issue' }],
  windowDigest: '1'.repeat(64),
  conformance: { status: 'passed', assertions: [] },
}
const acceptedState = { snapshot: current, report: { expiresAt: '2026-09-03T00:00:00Z' } }
const now = () => new Date('2026-08-27T00:00:00Z')
const sourceCheck = async () => ({ id: 'issues', status: 'current', assertions: [] })
const projectHead = async () => 'a'.repeat(40)

test('stays current when fixture, contracts, upstreams, and verification remain current', async () => {
  const result = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('separates window drift, truncation, contract drift, and upstream drift', async () => {
  const changed = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => ({ ...current, windowDigest: '2'.repeat(64) }), sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(changed.proposals.at(-1).action, 'review-github-work-item-window-change')
  const truncated = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => ({ ...current, coverage: { complete: false, truncationReason: 'max-items' } }), sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(truncated.proposals[0].action, 'expand-github-work-item-fixture-budget')
  const contracts = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => current, sourceCheck: async () => ({ id: 'issues', status: 'review-required' }), projectHead: async () => 'b'.repeat(40), acceptedState, sourceWatchList, projectCatalog })
  assert.deepEqual(contracts.proposals.map((proposal) => proposal.action), ['review-github-work-item-contract-change', 'review-github-work-item-upstream-change'])
})

test('requests scheduled upstream review and fresh verification without applying changes', async () => {
  const staleCatalog = { projects: [{ ...projectCatalog.projects[0], watch: { lastReviewedAt: '2026-08-01T00:00:00Z', reviewCadenceDays: 7 } }] }
  const result = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState: { ...acceptedState, report: { expiresAt: '2026-08-26T23:59:59Z' } }, sourceWatchList, projectCatalog: staleCatalog })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['scheduled-github-work-item-upstream-review', 'rerun-live-probe'])
})

test('distinguishes core rate limits, fixture removal, and implementation failures without retrying', async () => {
  for (const [error, status, action] of [
    [new GitHubPublicRepositoryWorkItemChangesError('rate', { code: 'rate-limited', retryAt: '2026-08-27T00:01:00Z' }), 'deferred', 'rerun-after-core-rate-limit'],
    [new GitHubPublicRepositoryWorkItemChangesError('missing', { code: 'repository-not-found' }), 'review-required', 'review-or-replace-github-work-item-fixture'],
  ]) {
    let calls = 0
    const result = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => { calls += 1; throw error }, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
    assert.equal(result.status, status)
    assert.equal(result.proposals.at(-1).action, action)
    assert.equal(calls, 1)
  }
  const failed = await collectGitHubWorkItemChangesMaintenance({ now, reader: async () => { throw new Error('shape drift') }, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals.at(-1).action, 'restore-github-work-item-access')
})

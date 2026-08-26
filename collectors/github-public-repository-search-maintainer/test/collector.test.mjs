import assert from 'node:assert/strict'
import test from 'node:test'
import { collectGitHubRepositorySearchMaintenance } from '../src/index.mjs'

test('proposes a replacement when the known public search fixture disappears', async () => {
  const reader = async () => ({ repositories: [], conformance: { status: 'passed', assertions: [] } })
  const result = await collectGitHubRepositorySearchMaintenance({ reader })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'replace-missing-search-fixture'), true)
})

test('turns API failures into connector proposals without retrying', async () => {
  let calls = 0
  const reader = async () => { calls += 1; throw new Error('HTTP_403') }
  const result = await collectGitHubRepositorySearchMaintenance({ reader })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].kind, 'connector-change-proposal')
  assert.equal(calls, 1)
})

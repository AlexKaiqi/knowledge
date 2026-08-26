import assert from 'node:assert/strict'
import test from 'node:test'
import { API_VERSION, normalizeRepositorySearchResponse, searchPublicRepositories } from '../src/index.mjs'

const headers = new Headers({
  'x-github-api-version-selected': API_VERSION,
  'x-ratelimit-resource': 'search',
  'x-ratelimit-limit': '10',
  'x-ratelimit-remaining': '9',
  'x-ratelimit-reset': '1787764321',
})

function item(overrides = {}) {
  return {
    id: 1,
    full_name: 'xpzouying/xiaohongshu-mcp',
    html_url: 'https://github.com/xpzouying/xiaohongshu-mcp',
    description: 'MCP for xiaohongshu.com',
    default_branch: 'main',
    fork: false,
    archived: false,
    disabled: false,
    visibility: 'public',
    license: { spdx_id: 'Apache-2.0' },
    topics: ['xiaohongshu-mcp', 'mcp'],
    updated_at: '2026-08-26T00:00:00Z',
    pushed_at: '2026-08-24T00:00:00Z',
    ...overrides,
  }
}

test('normalizes a bounded public repository search without claiming ecosystem completeness', () => {
  const result = normalizeRepositorySearchResponse({ total_count: 1, incomplete_results: false, items: [item()] }, { input: { query: 'xiaohongshu' }, headers, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.coverage.ecosystemComplete, false)
  assert.equal(result.coverage.representation, 'ranked-page')
  assert.deepEqual(result.repositories[0].topics, ['mcp', 'xiaohongshu-mcp'])
})

test('marks incomplete GitHub search results for review', () => {
  const result = normalizeRepositorySearchResponse({ total_count: 20, incomplete_results: true, items: [item()] }, { input: { query: 'xiaohongshu' }, headers })
  assert.equal(result.conformance.status, 'review-required')
  assert.equal(result.coverage.incompleteResults, true)
})

test('rejects malformed or non-public repository items before normalization', () => {
  assert.throws(() => normalizeRepositorySearchResponse({ total_count: 1, incomplete_results: false, items: [item({ visibility: 'private' })] }, { input: { query: 'xhs' }, headers }), /non-public/)
  assert.throws(() => normalizeRepositorySearchResponse({ total_count: 1, incomplete_results: false, items: [item({ id: undefined })] }, { input: { query: 'xhs' }, headers }), /item shape/)
})

test('rejects query injection and excessive page budgets before making a request', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => searchPublicRepositories({ query: 'xhs\nuser:other' }, { fetchImpl }), /single-line/)
  await assert.rejects(() => searchPublicRepositories({ query: 'xhs', perPage: 100 }, { fetchImpl }), /perPage/)
  assert.equal(calls, 0)
})

test('does not retry rate-limited requests', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response('{"message":"rate limited"}', { status: 403, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787764321' } })
  }
  await assert.rejects(() => searchPublicRepositories({ query: 'xhs' }, { fetchImpl }), /HTTP_403/)
  assert.equal(calls, 1)
})

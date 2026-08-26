import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_VERSION,
  GitHubPublicRepositoryWorkItemChangesError,
  MAX_RESPONSE_BYTES,
  listPublicRepositoryWorkItemChanges,
  normalizeRepositoryWorkItemPage,
} from '../src/index.mjs'

const checkpoint = { updatedAt: '2026-07-08T10:00:00.000Z', seenItemDigests: [] }
const input = { owner: 'xpzouying', repository: 'xiaohongshu-mcp', checkpoint, maxItems: 10 }

function item(number, {
  kind = 'issue', updatedAt = `2026-07-08T10:00:${String(number).padStart(2, '0')}.000Z`, title = `Work item ${number}`, body = `Body ${number}`, state = 'open', labels = [{ name: 'bug' }],
} = {}) {
  return {
    id: 1000 + number,
    number,
    url: `https://api.github.com/repos/xpzouying/xiaohongshu-mcp/issues/${number}`,
    repository_url: 'https://api.github.com/repos/xpzouying/xiaohongshu-mcp',
    html_url: `https://github.com/xpzouying/xiaohongshu-mcp/${kind === 'pull-request' ? 'pull' : 'issues'}/${number}`,
    state,
    state_reason: state === 'closed' ? 'completed' : null,
    title,
    body,
    labels,
    comments: 2,
    locked: false,
    created_at: '2026-07-08T09:00:00Z',
    updated_at: updatedAt.replace('.000Z', 'Z'),
    closed_at: state === 'closed' ? updatedAt.replace('.000Z', 'Z') : null,
    user: { login: 'excluded-user', email: 'excluded@example.com' },
    assignees: [{ login: 'excluded-assignee' }],
    ...(kind === 'pull-request' ? { pull_request: { url: `https://api.github.com/repos/xpzouying/xiaohongshu-mcp/pulls/${number}` } } : {}),
  }
}

function headers({ next = false, remaining = 40 } = {}) {
  return new Headers({
    'content-type': 'application/json',
    'x-github-api-version-selected': API_VERSION,
    'x-ratelimit-resource': 'core',
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': '1787785592',
    ...(next ? { link: '<https://api.github.com/repositories/1/issues?page=2>; rel="next", <https://api.github.com/repositories/1/issues?page=2>; rel="last"' } : {}),
  })
}

test('normalizes issues and pull requests while hashing rather than retaining bodies or people', () => {
  const result = normalizeRepositoryWorkItemPage([
    item(1, { title: 'Issue title', body: 'private-looking public body' }),
    item(2, { kind: 'pull-request', title: 'PR title', labels: ['enhancement'] }),
  ], { input, page: 1, headers: headers() })
  assert.equal(result.ordered, true)
  assert.equal(result.items[0].kind, 'issue')
  assert.equal(result.items[1].kind, 'pull-request')
  assert.deepEqual(result.items[1].labels, ['enhancement'])
  assert.equal(result.items[0].body.length, 27)
  assert.match(result.items[0].body.sha256, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(result).includes('private-looking public body'), false)
  assert.equal(JSON.stringify(result).includes('excluded-user'), false)
  assert.equal(JSON.stringify(result).includes('excluded@example.com'), false)
})

test('uses an overlapping composite checkpoint and suppresses an unchanged same-second replay', async () => {
  const first = normalizeRepositoryWorkItemPage([item(1, { updatedAt: checkpoint.updatedAt })], { input, page: 1, headers: headers() }).items[0]
  const replayInput = { ...input, checkpoint: { updatedAt: checkpoint.updatedAt, seenItemDigests: [{ number: 1, digest: first.changeDigest }] } }
  const responses = [
    new Response(JSON.stringify([item(1, { updatedAt: checkpoint.updatedAt }), item(2)]), { headers: headers({ next: true }) }),
    new Response(JSON.stringify([item(3)]), { headers: headers() }),
  ]
  let calls = 0
  const result = await listPublicRepositoryWorkItemChanges(replayInput, { fetchImpl: async (url, options) => {
    calls += 1
    assert.equal(url.origin, 'https://api.github.com')
    assert.equal(url.pathname, '/repos/xpzouying/xiaohongshu-mcp/issues')
    assert.equal(url.searchParams.get('state'), 'all')
    assert.equal(url.searchParams.get('sort'), 'updated')
    assert.equal(url.searchParams.get('direction'), 'asc')
    assert.equal(url.searchParams.get('since'), '2026-07-08T09:59:59Z')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers['x-github-api-version'], API_VERSION)
    return responses.shift()
  } })
  assert.equal(calls, 2)
  assert.deepEqual(result.items.map((entry) => entry.number), [2, 3])
  assert.equal(result.coverage.complete, true)
  assert.equal(result.nextCheckpoint.updatedAt, '2026-07-08T10:00:03.000Z')
  assert.deepEqual(result.nextCheckpoint.seenItemDigests.map((entry) => entry.number), [3])
  assert.equal(result.conformance.status, 'passed')
})

test('re-emits a same-second item when its semantic digest changes', async () => {
  const original = normalizeRepositoryWorkItemPage([item(1, { updatedAt: checkpoint.updatedAt })], { input, page: 1, headers: headers() }).items[0]
  const changed = item(1, { updatedAt: checkpoint.updatedAt, title: 'Changed within the checkpoint second' })
  const result = await listPublicRepositoryWorkItemChanges({ ...input, checkpoint: { updatedAt: checkpoint.updatedAt, seenItemDigests: [{ number: 1, digest: original.changeDigest }] } }, {
    fetchImpl: async () => new Response(JSON.stringify([changed]), { headers: headers() }),
  })
  assert.deepEqual(result.items.map((entry) => entry.number), [1])
  assert.notEqual(result.items[0].changeDigest, original.changeDigest)
  assert.equal(result.nextCheckpoint.seenItemDigests[0].digest, result.items[0].changeDigest)
})

test('declares truncation without losing a resumable checkpoint', async () => {
  const result = await listPublicRepositoryWorkItemChanges({ ...input, maxItems: 1 }, {
    fetchImpl: async () => new Response(JSON.stringify([item(1), item(2)]), { headers: headers() }),
  })
  assert.equal(result.items.length, 1)
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.truncated, true)
  assert.equal(result.coverage.truncationReason, 'max-items')
  assert.equal(result.nextCheckpoint.updatedAt, result.items[0].updatedAt)
})

test('stops after five fixed pages and declares a request-budget truncation', async () => {
  let calls = 0
  const result = await listPublicRepositoryWorkItemChanges({ ...input, maxItems: 500 }, {
    fetchImpl: async () => {
      calls += 1
      return new Response(JSON.stringify([item(calls)]), { headers: headers({ next: true }) })
    },
  })
  assert.equal(calls, 5)
  assert.equal(result.coverage.requestsMade, 5)
  assert.equal(result.coverage.complete, false)
  assert.equal(result.coverage.truncationReason, 'max-requests')
})

test('rejects injection, identity drift, invalid checkpoints, and unordered pages', async () => {
  await assert.rejects(() => listPublicRepositoryWorkItemChanges({ ...input, repository: '../secret' }, { fetchImpl: async () => {} }), /repository/)
  await assert.rejects(() => listPublicRepositoryWorkItemChanges({ ...input, checkpoint: { updatedAt: 'main', seenItemDigests: [] } }, { fetchImpl: async () => {} }), /canonical whole-second/)
  await assert.rejects(() => listPublicRepositoryWorkItemChanges({ ...input, url: 'https://example.com' }, { fetchImpl: async () => {} }), /unknown input/)
  assert.throws(() => normalizeRepositoryWorkItemPage([{ ...item(1), html_url: 'https://example.com/issues/1' }], { input, page: 1, headers: headers() }), /escaped/)
  const unordered = normalizeRepositoryWorkItemPage([item(2), item(1)], { input, page: 1, headers: headers() })
  assert.equal(unordered.ordered, false)
})

test('enforces response budgets and exposes typed non-retryable rate limits', async () => {
  await assert.rejects(() => listPublicRepositoryWorkItemChanges(input, {
    fetchImpl: async () => new Response('', { headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }),
  }), /2 MiB/)
  let calls = 0
  await assert.rejects(() => listPublicRepositoryWorkItemChanges(input, {
    now: () => new Date('2026-08-26T22:52:00Z'),
    fetchImpl: async () => { calls += 1; return new Response('{}', { status: 403, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787785592' } }) },
  }), (error) => error instanceof GitHubPublicRepositoryWorkItemChangesError && error.code === 'rate-limited' && error.retryAt === '2026-08-26T23:06:32.000Z')
  assert.equal(calls, 1)
})

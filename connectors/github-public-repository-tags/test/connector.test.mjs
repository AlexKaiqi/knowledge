import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { API_VERSION, GitHubPublicRepositoryTagsError, listPublicRepositoryTags, normalizeRepositoryTagPage, parsePublicGitHubRepositoryUrl } from '../src/index.mjs'

const input = { owner: 'tamnd', repository: 'xiaohongshu-cli', maxTags: 200 }

function tag(name, sha) {
  return {
    name,
    commit: {
      sha,
      url: `https://api.github.com/repos/tamnd/xiaohongshu-cli/commits/${sha}`,
    },
  }
}

function headers(overrides = {}) {
  return new Headers({
    'content-type': 'application/json; charset=utf-8',
    'x-github-api-version-selected': API_VERSION,
    'x-ratelimit-resource': 'core',
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': '59',
    'x-ratelimit-reset': '1787764321',
    ...overrides,
  })
}

test('normalizes a complete public repository tag set and compatible digest', async () => {
  const payload = [tag('v0.2.0', '2'.repeat(40)), tag('v0.1.0', '1'.repeat(40))]
  const result = await listPublicRepositoryTags(input, {
    fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: headers() }),
    now: () => new Date('2026-08-27T00:00:00Z'),
  })
  const normalized = `refs/tags/v0.1.0\t${'1'.repeat(40)}\nrefs/tags/v0.2.0\t${'2'.repeat(40)}`
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.coverage.tagSetComplete, true)
  assert.equal(result.coverage.requestsMade, 1)
  assert.deepEqual(result.tags.map((entry) => entry.name), ['v0.1.0', 'v0.2.0'])
  assert.equal(result.tagSetDigest, createHash('sha256').update(normalized).digest('hex'))
})

test('parses only canonical public GitHub repository URLs', () => {
  assert.deepEqual(parsePublicGitHubRepositoryUrl('https://github.com/tamnd/xiaohongshu-cli.git'), { owner: 'tamnd', repository: 'xiaohongshu-cli' })
  assert.throws(() => parsePublicGitHubRepositoryUrl('https://example.com/tamnd/xiaohongshu-cli.git'), /public GitHub/)
  assert.throws(() => parsePublicGitHubRepositoryUrl('https://github.com:8443/tamnd/xiaohongshu-cli.git'), /public GitHub/)
  assert.throws(() => parsePublicGitHubRepositoryUrl('https://github.com/tamnd/xiaohongshu-cli/issues'), /public GitHub/)
})

test('serially follows pagination up to the caller tag budget', async () => {
  const calls = []
  const first = Array.from({ length: 100 }, (_, index) => tag(`v1.${index}.0`, index.toString(16).padStart(40, '0')))
  const second = [tag('v0.0.0', 'f'.repeat(40))]
  const result = await listPublicRepositoryTags({ ...input, maxTags: 150 }, {
    fetchImpl: async (url) => {
      calls.push(url.href)
      return calls.length === 1
        ? new Response(JSON.stringify(first), { status: 200, headers: headers({ link: '<https://api.github.com/repositories/1/tags?page=2>; rel="next"' }) })
        : new Response(JSON.stringify(second), { status: 200, headers: headers({ 'x-ratelimit-remaining': '58' }) })
    },
  })
  assert.equal(calls.length, 2)
  assert.match(calls[0], /per_page=100&page=1/)
  assert.match(calls[1], /per_page=50&page=2/)
  assert.equal(result.coverage.tagSetComplete, true)
  assert.equal(result.coverage.returnedCount, 101)
  assert.equal(result.rateLimit.remaining, 58)
})

test('declares truncation instead of claiming a complete tag set', async () => {
  const result = await listPublicRepositoryTags({ ...input, maxTags: 1 }, {
    fetchImpl: async () => new Response(JSON.stringify([tag('v0.2.0', '2'.repeat(40))]), { status: 200, headers: headers({ link: '<https://api.github.com/repositories/1/tags?page=2>; rel="next"' }) }),
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.coverage.tagSetComplete, false)
  assert.equal(result.coverage.truncated, true)
  assert.equal(result.coverage.truncationReason, 'max-tags')
})

test('marks API version and rate bucket drift for review', async () => {
  const result = await listPublicRepositoryTags(input, {
    fetchImpl: async () => new Response(JSON.stringify([tag('v0.1.0', '1'.repeat(40))]), {
      status: 200,
      headers: headers({ 'x-github-api-version-selected': '2099-01-01', 'x-ratelimit-resource': 'other' }),
    }),
  })
  assert.equal(result.conformance.status, 'review-required')
  assert.deepEqual(result.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id), ['api-version', 'core-rate-bucket'])
  assert.equal(result.rateLimit.resource, 'other')
})

test('rejects unsafe inputs and identity drift before returning data', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => listPublicRepositoryTags({ owner: '../x', repository: 'repo' }, { fetchImpl }), /owner/)
  await assert.rejects(() => listPublicRepositoryTags({ owner: 'x', repository: 'repo.git' }, { fetchImpl }), /without \.git/)
  await assert.rejects(() => listPublicRepositoryTags({ owner: 'x', repository: 'repo', maxTags: 501 }, { fetchImpl }), /maxTags/)
  await assert.rejects(() => listPublicRepositoryTags({ owner: 'x', repository: 'repo' }, { fetchImpl, userAgent: 'bad\nagent' }), /userAgent/)
  assert.equal(calls, 0)
  assert.throws(() => normalizeRepositoryTagPage([tag('v0.1.0', '1'.repeat(40))], { input: { ...input, owner: 'other' }, page: 1, perPage: 100, headers: headers() }), /escaped/)
})

test('enforces response budgets and does not retry rate limits', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response('{"message":"rate limited"}', { status: 403, headers: headers({ 'x-ratelimit-remaining': '0' }) })
  }
  await assert.rejects(
    () => listPublicRepositoryTags(input, { fetchImpl }),
    (error) => error instanceof GitHubPublicRepositoryTagsError && error.code === 'rate-limited' && error.httpStatus === 403,
  )
  assert.equal(calls, 1)
  await assert.rejects(
    () => listPublicRepositoryTags(input, { fetchImpl: async () => new Response('[]', { status: 200, headers: headers({ 'content-length': String(2 * 1024 * 1024 + 1) }) }) }),
    /2 MiB/,
  )
  await assert.rejects(
    () => listPublicRepositoryTags(input, { fetchImpl: async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { status: 200, headers: headers() }) }),
    /2 MiB/,
  )
  await assert.rejects(
    () => listPublicRepositoryTags(input, { fetchImpl: async () => new Response(new Uint8Array([0xff]), { status: 200, headers: headers() }) }),
    /valid UTF-8/,
  )
})

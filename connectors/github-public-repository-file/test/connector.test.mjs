import assert from 'node:assert/strict'
import test from 'node:test'
import { API_VERSION, GitHubPublicRepositoryFileError, MAX_FILE_BYTES, normalizePublicRepositoryFileResponse, readPublicRepositoryFile } from '../src/index.mjs'

const revision = '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d'
const input = { repository: 'octocat/Hello-World', path: 'README', revision }
const headers = new Headers({
  'x-github-api-version-selected': API_VERSION,
  'x-ratelimit-resource': 'core',
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': '59',
  'x-ratelimit-reset': '1787766804',
})

function payload(overrides = {}) {
  const content = Buffer.from('Hello World!\n').toString('base64')
  return {
    type: 'file',
    encoding: 'base64',
    content,
    size: 13,
    name: 'README',
    path: 'README',
    sha: '980a0d5f19a64b4b30a87d4206aade58726b60e3',
    html_url: `https://github.com/octocat/Hello-World/blob/${revision}/README`,
    url: 'https://api.github.com/repos/octocat/Hello-World/contents/README',
    ...overrides,
  }
}

test('normalizes a bounded UTF-8 file at an immutable revision', () => {
  const result = normalizePublicRepositoryFileResponse(payload(), { input, headers, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.file.content, 'Hello World!\n')
  assert.equal(result.file.contentSha256, '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340')
  assert.equal(result.request.revision, revision)
})

test('marks API version and rate bucket drift for review', () => {
  const result = normalizePublicRepositoryFileResponse(payload(), { input, headers: new Headers({ 'x-github-api-version-selected': '2022-11-28', 'x-ratelimit-resource': 'search' }) })
  assert.equal(result.conformance.status, 'review-required')
  assert.deepEqual(result.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id), ['api-version', 'core-rate-bucket'])
})

test('rejects mutable revisions and path traversal before making a request', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicRepositoryFile({ ...input, revision: 'main' }, { fetchImpl }), /full lowercase/)
  await assert.rejects(() => readPublicRepositoryFile({ ...input, path: '../README' }, { fetchImpl }), /parent segments/)
  await assert.rejects(() => readPublicRepositoryFile({ ...input, path: '/README' }, { fetchImpl }), /relative repository path/)
  assert.equal(calls, 0)
})

test('rejects directories, oversized files, size mismatch, binary data, and revision drift', () => {
  assert.throws(() => normalizePublicRepositoryFileResponse(payload({ type: 'dir' }), { input, headers }), /bounded file payload/)
  assert.throws(() => normalizePublicRepositoryFileResponse(payload({ size: MAX_FILE_BYTES + 1 }), { input, headers }), /bounded file payload/)
  assert.throws(() => normalizePublicRepositoryFileResponse(payload({ size: 12 }), { input, headers }), /size does not match/)
  const binary = Buffer.from([0, 1, 2]).toString('base64')
  assert.throws(() => normalizePublicRepositoryFileResponse(payload({ content: binary, size: 3 }), { input, headers }), /binary/)
  assert.throws(() => normalizePublicRepositoryFileResponse(payload({ html_url: 'https://github.com/octocat/Hello-World/blob/main/README' }), { input, headers }), /immutable revision/)
})

test('encodes path segments and does not retry failed requests', async () => {
  let calls = 0
  let requestedUrl
  const fetchImpl = async (url) => {
    calls += 1
    requestedUrl = String(url)
    return new Response('{"message":"not found"}', { status: 404, headers: { 'content-type': 'application/json' } })
  }
  await assert.rejects(() => readPublicRepositoryFile({ ...input, path: 'docs/a b.md' }, { fetchImpl }), /HTTP_404/)
  assert.match(requestedUrl, /\/contents\/docs\/a%20b\.md\?ref=/)
  assert.equal(calls, 1)
})

test('exposes exhausted core budget as a typed non-retryable error', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response('{"message":"rate limit exceeded"}', {
      status: 403,
      headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787767449' },
    })
  }
  await assert.rejects(
    () => readPublicRepositoryFile(input, { fetchImpl }),
    (error) => error instanceof GitHubPublicRepositoryFileError
      && error.code === 'rate-limited'
      && error.rateLimitRemaining === 0
      && error.rateLimitResetAt === '2026-08-26T18:04:09.000Z',
  )
  assert.equal(calls, 1)
})

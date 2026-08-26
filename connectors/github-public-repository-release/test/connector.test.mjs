import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_VERSION,
  GitHubPublicRepositoryReleaseError,
  MAX_ASSETS,
  MAX_NOTES_EXCERPT_CHARACTERS,
  MAX_RESPONSE_BYTES,
  normalizePublicRepositoryReleaseResponse,
  readPublicRepositoryReleaseByTag,
} from '../src/index.mjs'

const input = { owner: 'JoeanAmier', repository: 'XHS-Downloader', tagName: '2.7' }
const headers = new Headers({
  etag: 'W/"fixture"',
  'x-github-api-version-selected': API_VERSION,
  'x-ratelimit-resource': 'core',
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': '3',
  'x-ratelimit-reset': '1787774688',
})

function asset(overrides = {}) {
  return {
    name: 'XHS-Downloader_V2.7_Windows_X64.zip',
    label: '',
    state: 'uploaded',
    content_type: 'application/zip',
    size: 41013054,
    digest: 'sha256:ff5e7b6355895d5d18232f5db69d5b08c7237720c2c8c57b1d9b5bde8fa40c99',
    browser_download_url: 'https://github.com/JoeanAmier/XHS-Downloader/releases/download/2.7/XHS-Downloader_V2.7_Windows_X64.zip',
    created_at: '2026-02-09T06:42:32Z',
    updated_at: '2026-02-09T06:42:34Z',
    download_count: 12073,
    uploader: { login: 'excluded-bot', avatar_url: 'https://example.invalid/avatar' },
    ...overrides,
  }
}

function payload(overrides = {}) {
  return {
    id: 1,
    tag_name: '2.7',
    target_commitish: 'master',
    name: 'XHS-Downloader V2.7',
    body: 'Release notes',
    draft: false,
    prerelease: false,
    immutable: false,
    created_at: '2026-02-09T06:35:57Z',
    published_at: '2026-02-09T06:40:22Z',
    html_url: 'https://github.com/JoeanAmier/XHS-Downloader/releases/tag/2.7',
    tarball_url: 'https://api.github.com/repos/JoeanAmier/XHS-Downloader/tarball/2.7',
    zipball_url: 'https://api.github.com/repos/JoeanAmier/XHS-Downloader/zipball/2.7',
    author: { login: 'excluded-author' },
    assets: [asset()],
    ...overrides,
  }
}

test('normalizes an exact public release and minimizes people, counters, and archive links', () => {
  const result = normalizePublicRepositoryReleaseResponse(payload(), { input, headers, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.release.tagName, '2.7')
  assert.equal(result.release.notes.excerpt, 'Release notes')
  assert.equal(result.release.assetCoverage.sha256Count, 1)
  assert.equal(result.release.assetCoverage.completeness, 'not-asserted')
  assert.equal(result.release.assets[0].sha256, 'ff5e7b6355895d5d18232f5db69d5b08c7237720c2c8c57b1d9b5bde8fa40c99')
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('excluded-author'), false)
  assert.equal(serialized.includes('excluded-bot'), false)
  assert.equal(serialized.includes('download_count'), false)
  assert.equal(serialized.includes('tarball_url'), false)
})

test('bounds release notes to an excerpt while preserving full-body identity', () => {
  const body = '文'.repeat(MAX_NOTES_EXCERPT_CHARACTERS + 2)
  const result = normalizePublicRepositoryReleaseResponse(payload({ body }), { input, headers })
  assert.equal([...result.release.notes.excerpt].length, MAX_NOTES_EXCERPT_CHARACTERS)
  assert.equal(result.release.notes.characterCount, MAX_NOTES_EXCERPT_CHARACTERS + 2)
  assert.equal(result.release.notes.truncated, true)
  assert.match(result.release.notes.sha256, /^[a-f0-9]{64}$/)
})

test('accepts missing asset digests without inventing integrity', () => {
  const result = normalizePublicRepositoryReleaseResponse(payload({ assets: [asset({ digest: null })] }), { input, headers })
  assert.equal(result.release.assets[0].sha256, null)
  assert.equal(result.release.assetCoverage.sha256Count, 0)
})

test('rejects unsafe ref names and endpoint injection before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  for (const tagName of ['../main', 'main lock', 'main^', 'refs//tags/v1', 'v1.lock']) {
    await assert.rejects(() => readPublicRepositoryReleaseByTag({ ...input, tagName }, { fetchImpl }), /exact bounded Git ref/)
  }
  await assert.rejects(() => readPublicRepositoryReleaseByTag({ ...input, baseUrl: 'https://example.com' }, { fetchImpl }), /unknown input fields/)
  await assert.rejects(() => readPublicRepositoryReleaseByTag({ ...input, repository: '../private' }, { fetchImpl }), /bounded GitHub repository/)
  assert.equal(calls, 0)
})

test('rejects release identity, draft, URL, asset origin, digest, and asset bounds drift', () => {
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ tag_name: '2.6' }), { input, headers }), /identity or bounded shape/)
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ draft: true }), { input, headers }), /draft/)
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ html_url: 'https://example.com/release' }), { input, headers }), /escaped/)
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ assets: [asset({ browser_download_url: 'https://example.com/file.zip' })] }), { input, headers }), /escaped/)
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ assets: [asset({ digest: 'sha1:bad' })] }), { input, headers }), /digest shape/)
  assert.throws(() => normalizePublicRepositoryReleaseResponse(payload({ assets: Array.from({ length: MAX_ASSETS + 1 }, () => asset()) }), { input, headers }), /bounded shape/)
})

test('requires review for API header, ETag, rate bucket, or asset state drift', () => {
  const result = normalizePublicRepositoryReleaseResponse(payload({ assets: [asset({ state: 'new' })] }), { input, headers: new Headers() })
  assert.equal(result.conformance.status, 'review-required')
  assert.deepEqual(result.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id), ['api-version', 'core-rate-bucket', 'etag-present', 'uploaded-assets'])
})

test('makes one fixed official request and does not retry rate limits or missing releases', async () => {
  let request
  let calls = 0
  const fetchImpl = async (url, options) => {
    calls += 1
    request = { url: url.href, options }
    return new Response(JSON.stringify(payload()), { status: 200, headers: { ...Object.fromEntries(headers), 'content-type': 'application/json' } })
  }
  const result = await readPublicRepositoryReleaseByTag(input, { fetchImpl })
  assert.equal(result.release.tagName, input.tagName)
  assert.equal(request.url, 'https://api.github.com/repos/JoeanAmier/XHS-Downloader/releases/tags/2.7')
  assert.equal(request.options.redirect, 'error')
  assert.equal(request.options.headers['x-github-api-version'], API_VERSION)
  const limited = async () => {
    calls += 1
    return new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787774688' } })
  }
  await assert.rejects(() => readPublicRepositoryReleaseByTag(input, { fetchImpl: limited }), (error) => error instanceof GitHubPublicRepositoryReleaseError && error.code === 'rate-limited')
  const missing = async () => {
    calls += 1
    return new Response('{}', { status: 404 })
  }
  await assert.rejects(() => readPublicRepositoryReleaseByTag(input, { fetchImpl: missing }), (error) => error instanceof GitHubPublicRepositoryReleaseError && error.code === 'release-not-found')
  assert.equal(calls, 3)
})

test('enforces the streaming response budget', async () => {
  const fetchImpl = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } })
  await assert.rejects(() => readPublicRepositoryReleaseByTag(input, { fetchImpl }), /2 MiB budget/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_DISTRIBUTIONS, MAX_RESPONSE_BYTES, normalizePublicProjectReleaseResponse, PyPIPublicProjectReleaseError, readPublicProjectRelease } from '../src/index.mjs'

const input = { projectName: 'sampleproject', version: '4.0.0' }
const headers = new Headers({
  etag: '"fixture-etag"',
  'x-pypi-last-serial': '25862117',
  'cache-control': 'max-age=900, public',
})

function distribution(overrides = {}) {
  return {
    filename: 'sampleproject-4.0.0-py3-none-any.whl',
    packagetype: 'bdist_wheel',
    python_version: 'py3',
    requires_python: '>=3.9',
    size: 4661,
    upload_time_iso_8601: '2024-11-06T22:37:09.220617Z',
    yanked: false,
    yanked_reason: null,
    url: 'https://files.pythonhosted.org/packages/d7/73/c16e5f3f0d37c60947e70865c255a58dc408780a6474de0523afd0ec553a/sampleproject-4.0.0-py3-none-any.whl',
    digests: {
      sha256: 'c23e447ea90d796d1e645c35c4b2de125040add12a845825546f91c93f391b6b',
      blake2b_256: 'd773c16e5f3f0d37c60947e70865c255a58dc408780a6474de0523afd0ec553a',
    },
    'core-metadata': { sha256: '067ccfe9a9c2bab291a27fa8662536adbd63ab12e3da003ae5dffdb0d20b2061' },
    ...overrides,
  }
}

function payload(overrides = {}) {
  return {
    info: {
      name: 'sampleproject',
      version: '4.0.0',
      summary: 'A sample Python project',
      requires_python: '>=3.9',
      license_expression: null,
      classifiers: ['Programming Language :: Python :: 3', 'License :: OSI Approved :: MIT License'],
      project_urls: { Source: 'https://github.com/pypa/sampleproject/', Funding: 'https://donate.example/', 'Say Thanks!': 'http://example.invalid/thanks' },
      yanked: false,
      yanked_reason: null,
      author_email: 'excluded@example.invalid',
    },
    last_serial: 25862117,
    urls: [distribution()],
    vulnerabilities: [],
    ...overrides,
  }
}

test('normalizes an exact bounded PyPI release without personal metadata', () => {
  const result = normalizePublicProjectReleaseResponse(payload(), { input, headers, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.release.licenseClassifiers, ['License :: OSI Approved :: MIT License'])
  assert.deepEqual(result.release.projectUrls, [{ label: 'Source', url: 'https://github.com/pypa/sampleproject/' }])
  assert.equal(result.distributions[0].coreMetadataSha256, '067ccfe9a9c2bab291a27fa8662536adbd63ab12e3da003ae5dffdb0d20b2061')
  assert.equal(JSON.stringify(result).includes('excluded@example.invalid'), false)
})

test('accepts a normalized input alias only when response identity normalizes to it', () => {
  const aliasInput = { projectName: 'my-project', version: '1.0.0' }
  const result = normalizePublicProjectReleaseResponse(payload({ info: { ...payload().info, name: 'My_Project', version: '1.0.0' } }), { input: aliasInput, headers })
  assert.equal(result.release.canonicalProjectName, 'my-project')
  assert.equal(result.release.publishedProjectName, 'My_Project')
})

test('rejects latest/ranges, non-normalized names, alternate base URLs, and traversal before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicProjectRelease({ projectName: 'sampleproject', version: 'latest' }, { fetchImpl }), /exact normalized/)
  await assert.rejects(() => readPublicProjectRelease({ projectName: 'Sample_Project', version: '4.0.0' }, { fetchImpl }), /normalized lowercase/)
  await assert.rejects(() => readPublicProjectRelease({ projectName: '../private', version: '1.0.0' }, { fetchImpl }), /normalized lowercase/)
  await assert.rejects(() => readPublicProjectRelease({ ...input, baseUrl: 'https://example.com' }, { fetchImpl }), /unknown input fields/)
  assert.equal(calls, 0)
})

test('rejects identity, distribution digest, filename, origin, and bound drift', () => {
  assert.throws(() => normalizePublicProjectReleaseResponse(payload({ info: { ...payload().info, version: '3.0.0' } }), { input, headers }), /identity or bounded shape/)
  assert.throws(() => normalizePublicProjectReleaseResponse(payload({ urls: [distribution({ digests: { ...distribution().digests, sha256: 'bad' } })] }), { input, headers }), /distribution metadata shape/)
  assert.throws(() => normalizePublicProjectReleaseResponse(payload({ urls: [distribution({ filename: '../bad.whl' })] }), { input, headers }), /distribution metadata shape/)
  assert.throws(() => normalizePublicProjectReleaseResponse(payload({ urls: [distribution({ url: 'https://evil.example/sampleproject.whl' })] }), { input, headers }), /escaped files.pythonhosted/)
  assert.throws(() => normalizePublicProjectReleaseResponse(payload({ urls: Array.from({ length: MAX_DISTRIBUTIONS + 1 }, () => distribution()) }), { input, headers }), /bounded shape/)
})

test('marks missing ETag or serial mismatch for review', () => {
  const result = normalizePublicProjectReleaseResponse(payload(), { input, headers: new Headers({ 'x-pypi-last-serial': '1' }) })
  assert.equal(result.conformance.status, 'review-required')
  assert.deepEqual(result.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id), ['etag-present', 'serial-consistent'])
})

test('enforces response budget and exposes rate limits without retrying', async () => {
  let calls = 0
  const tooLarge = async () => {
    calls += 1
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } })
  }
  await assert.rejects(() => readPublicProjectRelease(input, { fetchImpl: tooLarge }), /2 MiB budget/)
  const limited = async () => {
    calls += 1
    return new Response('{"message":"limited"}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '120' } })
  }
  await assert.rejects(
    () => readPublicProjectRelease(input, { fetchImpl: limited, now: () => new Date('2026-08-27T00:00:00Z') }),
    (error) => error instanceof PyPIPublicProjectReleaseError && error.code === 'rate-limited' && error.retryAt === '2026-08-27T00:02:00.000Z',
  )
  assert.equal(calls, 2)
})

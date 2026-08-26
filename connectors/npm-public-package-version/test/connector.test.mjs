import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RESPONSE_BYTES, normalizePublicPackageVersionResponse, NpmPublicPackageVersionError, readPublicPackageVersion } from '../src/index.mjs'

const input = { packageName: 'ajv', version: '8.20.0' }

function payload(overrides = {}) {
  return {
    name: 'ajv',
    version: '8.20.0',
    description: 'Another JSON Schema Validator',
    license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/ajv-validator/ajv.git' },
    engines: { node: '>=12.0.0' },
    maintainers: [{ name: 'hidden', email: 'hidden@example.invalid' }],
    dist: {
      integrity: 'sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==',
      shasum: '304b3636add88ba7d936760dd50ece006dea95f9',
      tarball: 'https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz',
    },
    ...overrides,
  }
}

test('normalizes an exact public package version without personal fields', () => {
  const result = normalizePublicPackageVersionResponse(payload(), { input, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.packageVersion.distribution.shasum, '304b3636add88ba7d936760dd50ece006dea95f9')
  assert.deepEqual(result.packageVersion.engines, { node: '>=12.0.0' })
  assert.equal(JSON.stringify(result).includes('hidden@example.invalid'), false)
})

test('rejects tags, ranges, uppercase names, unknown fields, and path injection before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicPackageVersion({ packageName: 'ajv', version: 'latest' }, { fetchImpl }), /exact semantic version/)
  await assert.rejects(() => readPublicPackageVersion({ packageName: 'ajv', version: '^8.0.0' }, { fetchImpl }), /exact semantic version/)
  await assert.rejects(() => readPublicPackageVersion({ packageName: 'AJV', version: '8.20.0' }, { fetchImpl }), /lowercase/)
  await assert.rejects(() => readPublicPackageVersion({ packageName: '../private', version: '1.0.0' }, { fetchImpl }), /lowercase/)
  await assert.rejects(() => readPublicPackageVersion({ ...input, registry: 'https://example.com' }, { fetchImpl }), /unknown input fields/)
  assert.equal(calls, 0)
})

test('rejects response identity, distribution integrity, and tarball origin drift', () => {
  assert.throws(() => normalizePublicPackageVersionResponse(payload({ version: '8.19.0' }), { input }), /identity changed/)
  assert.throws(() => normalizePublicPackageVersionResponse(payload({ dist: { ...payload().dist, integrity: 'sha256-bad' } }), { input }), /integrity metadata/)
  assert.throws(() => normalizePublicPackageVersionResponse(payload({ dist: { ...payload().dist, tarball: 'https://evil.example/ajv-8.20.0.tgz' } }), { input }), /escaped the public registry/)
})

test('supports encoded scoped package names on the fixed public registry', async () => {
  let requestedUrl
  const scopedInput = { packageName: '@scope/pkg', version: '1.2.3-beta.1' }
  const scopedPayload = payload({
    name: '@scope/pkg',
    version: '1.2.3-beta.1',
    dist: { ...payload().dist, tarball: 'https://registry.npmjs.org/@scope/pkg/-/pkg-1.2.3-beta.1.tgz' },
  })
  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return new Response(JSON.stringify(scopedPayload), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await readPublicPackageVersion(scopedInput, { fetchImpl })
  assert.match(requestedUrl, /registry\.npmjs\.org\/%40scope%2Fpkg\/1\.2\.3-beta\.1/)
  assert.equal(result.packageVersion.name, '@scope/pkg')
})

test('enforces response budget and does not retry HTTP failures', async () => {
  let calls = 0
  const tooLarge = async () => {
    calls += 1
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } })
  }
  await assert.rejects(() => readPublicPackageVersion(input, { fetchImpl: tooLarge }), /1 MiB budget/)
  const unavailable = async () => {
    calls += 1
    return new Response('{"error":"unavailable"}', { status: 503, headers: { 'content-type': 'application/json', 'retry-after': '60' } })
  }
  await assert.rejects(() => readPublicPackageVersion(input, { fetchImpl: unavailable }), /HTTP_503; retryAfter=60/)
  assert.equal(calls, 2)
})

test('exposes Registry rate limiting as a typed non-retryable error', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response('{"error":"too many requests"}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '120' } })
  }
  await assert.rejects(
    () => readPublicPackageVersion(input, { fetchImpl, now: () => new Date('2026-08-27T00:00:00Z') }),
    (error) => error instanceof NpmPublicPackageVersionError
      && error.code === 'rate-limited'
      && error.retryAfter === '120'
      && error.retryAt === '2026-08-27T00:02:00.000Z',
  )
  assert.equal(calls, 1)
})

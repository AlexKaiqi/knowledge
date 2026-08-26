import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRequestGate,
  CratesIoPublicCrateVersionError,
  MAX_BINARY_NAMES,
  MAX_RESPONSE_BYTES,
  normalizePublicCrateVersionResponse,
  readPublicCrateVersion,
} from '../src/index.mjs'

const input = { crateName: 'serde', version: '1.0.228' }

function payload(overrides = {}) {
  return {
    version: {
      crate: 'serde',
      num: '1.0.228',
      dl_path: '/api/v1/crates/serde/1.0.228/download',
      created_at: '2025-09-27T16:51:35.265429Z',
      updated_at: '2025-09-27T16:51:35.265429Z',
      downloads: 123456,
      features: { default: ['std'] },
      yanked: false,
      yank_message: null,
      license: 'MIT OR Apache-2.0',
      crate_size: 83652,
      published_by: { id: 42, login: 'excluded-user', avatar: 'https://example.invalid/avatar' },
      audit_actions: [{ action: 'publish', user: { login: 'excluded-user' } }],
      checksum: '9a8e94ea7f378bd32cbbd37198a4a91436180c5bb472411e48b5ec2e2124ae9e',
      rust_version: '1.56',
      has_lib: true,
      bin_names: [],
      edition: '2021',
      description: 'A generic serialization/deserialization framework',
      homepage: 'https://serde.rs',
      documentation: 'https://docs.rs/serde',
      repository: 'https://github.com/serde-rs/serde',
      ...overrides,
    },
  }
}

test('normalizes an exact crate version and excludes personal or unbounded fields', () => {
  const result = normalizePublicCrateVersionResponse(payload(), { input, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.crateVersion.artifact.sha256, '9a8e94ea7f378bd32cbbd37198a4a91436180c5bb472411e48b5ec2e2124ae9e')
  assert.equal(result.crateVersion.artifact.downloadUrl, 'https://crates.io/api/v1/crates/serde/1.0.228/download')
  assert.deepEqual(result.crateVersion.links, {
    repository: 'https://github.com/serde-rs/serde',
    homepage: 'https://serde.rs/',
    documentation: 'https://docs.rs/serde',
  })
  assert.equal(JSON.stringify(result).includes('excluded-user'), false)
  assert.equal(Object.hasOwn(result.crateVersion, 'features'), false)
  assert.equal(Object.hasOwn(result.crateVersion, 'downloads'), false)
})

test('accepts official crate name characters and exact prerelease semver only', () => {
  const candidateInput = { crateName: 'Serde_Test-2', version: '1.2.3-rc.1+build.7' }
  const result = normalizePublicCrateVersionResponse(payload({
    crate: candidateInput.crateName,
    num: candidateInput.version,
    dl_path: `/api/v1/crates/${candidateInput.crateName}/${candidateInput.version}/download`,
  }), { input: candidateInput })
  assert.equal(result.crateVersion.crateName, candidateInput.crateName)
})

test('rejects ranges, aliases, invalid names, alternate endpoints, and generic user agents before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  const noGate = async () => {}
  await assert.rejects(() => readPublicCrateVersion({ crateName: 'serde', version: '^1.0.0' }, { fetchImpl, requestGate: noGate }), /exact semantic version/)
  await assert.rejects(() => readPublicCrateVersion({ crateName: '../serde', version: '1.0.0' }, { fetchImpl, requestGate: noGate }), /exact registered/)
  await assert.rejects(() => readPublicCrateVersion({ ...input, baseUrl: 'https://example.com' }, { fetchImpl, requestGate: noGate }), /unknown input fields/)
  await assert.rejects(() => readPublicCrateVersion(input, { fetchImpl, requestGate: noGate, userAgent: 'undici' }), /identify an application/)
  assert.equal(calls, 0)
})

test('rejects response identity, checksum, download origin, timestamp, and binary bounds drift', () => {
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ num: '1.0.227' }), { input }), /identity or integrity/)
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ checksum: 'bad' }), { input }), /identity or integrity/)
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ dl_path: 'https://example.com/file.crate' }), { input }), /escaped/)
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ created_at: 'not-a-date' }), { input }), /created_at/)
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ has_lib: 'false' }), { input }), /has_lib/)
  assert.throws(() => normalizePublicCrateVersionResponse(payload({ bin_names: Array.from({ length: MAX_BINARY_NAMES + 1 }, (_, index) => `bin-${index}`) }), { input }), /bounded shape/)
})

test('drops insecure publisher links instead of exposing them', () => {
  const result = normalizePublicCrateVersionResponse(payload({ homepage: 'http://example.com', repository: 'https://user:pass@example.com/private' }), { input })
  assert.equal(result.crateVersion.links.homepage, null)
  assert.equal(result.crateVersion.links.repository, null)
})

test('serializes request starts at no more than one per second', async () => {
  let currentTime = 0
  const waits = []
  const gate = createRequestGate({
    nowMs: () => currentTime,
    sleep: async (delay) => { waits.push(delay); currentTime += delay },
  })
  await gate()
  await gate()
  await Promise.all([gate(), gate()])
  assert.deepEqual(waits, [1000, 1000, 1000])
  assert.throws(() => createRequestGate({ minimumIntervalMs: 999 }), /cannot be below/)
})

test('uses one fixed official request with a contactable user agent', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url: url.href, options }
    return new Response(JSON.stringify(payload()), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await readPublicCrateVersion(input, { fetchImpl, requestGate: async () => {}, now: () => new Date('2026-08-27T00:00:00Z') })
  assert.equal(result.crateVersion.version, input.version)
  assert.equal(request.url, 'https://crates.io/api/v1/crates/serde/1.0.228')
  assert.equal(request.options.redirect, 'error')
  assert.match(request.options.headers['user-agent'], /https:\/\//)
})

test('enforces the response budget and exposes policy blocks and rate limits without retrying', async () => {
  let calls = 0
  const noGate = async () => {}
  const tooLarge = async () => {
    calls += 1
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } })
  }
  await assert.rejects(() => readPublicCrateVersion(input, { fetchImpl: tooLarge, requestGate: noGate }), /1 MiB budget/)
  const blocked = async () => {
    calls += 1
    return new Response('{}', { status: 403, headers: { 'content-type': 'application/json' } })
  }
  await assert.rejects(
    () => readPublicCrateVersion(input, { fetchImpl: blocked, requestGate: noGate }),
    (error) => error instanceof CratesIoPublicCrateVersionError && error.code === 'access-policy-blocked',
  )
  const limited = async () => {
    calls += 1
    return new Response('{}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '120' } })
  }
  await assert.rejects(
    () => readPublicCrateVersion(input, { fetchImpl: limited, requestGate: noGate, now: () => new Date('2026-08-27T00:00:00Z') }),
    (error) => error instanceof CratesIoPublicCrateVersionError && error.code === 'rate-limited' && error.retryAt === '2026-08-27T00:02:00.000Z',
  )
  assert.equal(calls, 3)
})

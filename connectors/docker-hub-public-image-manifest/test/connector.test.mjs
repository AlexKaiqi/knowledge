import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  ACCEPTED_MANIFEST_MEDIA_TYPES,
  DockerHubPublicImageManifestError,
  MAX_MANIFEST_RESPONSE_BYTES,
  normalizeDockerHubManifestResponse,
  readPublicImageManifestByDigest,
} from '../src/index.mjs'

const stableBytes = (value) => new TextEncoder().encode(JSON.stringify(value))
const digestOf = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

const indexPayload = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      size: 1024,
      digest: `sha256:${'1'.repeat(64)}`,
      platform: { architecture: 'amd64', os: 'linux' },
    },
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      size: 768,
      digest: `sha256:${'2'.repeat(64)}`,
      platform: { architecture: 'unknown', os: 'unknown' },
      annotations: {
        'vnd.docker.reference.type': 'attestation-manifest',
        'vnd.docker.reference.digest': `sha256:${'1'.repeat(64)}`,
        'org.opencontainers.image.authors': 'excluded@example.invalid',
      },
    },
  ],
  annotations: { 'org.opencontainers.image.ref.name': 'mutable-and-excluded' },
}

function manifestHeaders(bytes, overrides = {}) {
  const digest = digestOf(bytes)
  return new Headers({
    'content-type': indexPayload.mediaType,
    'content-length': String(bytes.byteLength),
    'docker-content-digest': digest,
    'docker-distribution-api-version': 'registry/2.0',
    'ratelimit-limit': '100;w=21600',
    'ratelimit-remaining': '99;w=21600',
    ...overrides,
  })
}

test('normalizes a digest-verified OCI index and minimizes annotations, identities, and mutable tags', () => {
  const bytes = stableBytes(indexPayload)
  const manifestDigest = digestOf(bytes)
  const result = normalizeDockerHubManifestResponse(bytes, {
    input: { repository: 'library/alpine', manifestDigest },
    headers: manifestHeaders(bytes),
    observedAt: '2026-08-27T00:00:00.000Z',
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.manifest.kind, 'image-index')
  assert.equal(result.manifest.digest, manifestDigest)
  assert.equal(result.manifest.descriptorCount, 2)
  assert.equal(result.manifest.declaredReferencedBytes, 1792)
  assert.equal(result.manifest.descriptors[0].role, 'image')
  assert.equal(result.manifest.descriptors[1].role, 'attestation')
  assert.equal(result.manifest.descriptors[1].referencedDigest, `sha256:${'1'.repeat(64)}`)
  assert.deepEqual(result.rateLimit, { limit: 100, remaining: 99, windowSeconds: 21600 })
  assert.equal(result.access.blobsDownloaded, false)
  assert.doesNotMatch(JSON.stringify(result), /excluded@example|mutable-and-excluded|authors|ref\.name/i)
})

test('normalizes an exact single-platform image manifest without fetching config or layers', () => {
  const payload = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { mediaType: 'application/vnd.oci.image.config.v1+json', size: 7023, digest: `sha256:${'3'.repeat(64)}` },
    layers: [
      { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 32654, digest: `sha256:${'4'.repeat(64)}` },
      { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 16724, digest: `sha256:${'5'.repeat(64)}` },
    ],
  }
  const bytes = stableBytes(payload)
  const headers = manifestHeaders(bytes, { 'content-type': payload.mediaType, 'ratelimit-limit': null, 'ratelimit-remaining': null })
  headers.delete('ratelimit-limit')
  headers.delete('ratelimit-remaining')
  const result = normalizeDockerHubManifestResponse(bytes, {
    input: { repository: 'library/example', manifestDigest: digestOf(bytes) },
    headers,
  })
  assert.equal(result.manifest.kind, 'image-manifest')
  assert.deepEqual(result.manifest.descriptors.map((descriptor) => descriptor.role), ['config', 'layer', 'layer'])
  assert.equal(result.manifest.declaredReferencedBytes, 56401)
})

test('rejects mutable references, unsafe repositories, aliases, and unknown fields before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1; throw new Error('must not fetch') }
  const invalid = [
    { repository: 'library/alpine', manifestDigest: 'latest' },
    { repository: 'Library/alpine', manifestDigest: `sha256:${'a'.repeat(64)}` },
    { repository: 'library/alpine/extra', manifestDigest: `sha256:${'a'.repeat(64)}` },
    { repository: 'library/../alpine', manifestDigest: `sha256:${'a'.repeat(64)}` },
    { repository: 'library/alpine', manifestDigest: `sha256:${'A'.repeat(64)}` },
    { repository: 'library/alpine', manifestDigest: `sha256:${'a'.repeat(64)}`, registry: 'https://evil.invalid' },
  ]
  for (const input of invalid) await assert.rejects(() => readPublicImageManifestByDigest(input, { fetchImpl }))
  assert.equal(calls, 0)
})

test('rejects body, canonical header, media type, artifact, descriptor, and length drift', () => {
  const bytes = stableBytes(indexPayload)
  const input = { repository: 'library/alpine', manifestDigest: digestOf(bytes) }
  assert.throws(() => normalizeDockerHubManifestResponse(stableBytes({ ...indexPayload, extra: true }), { input, headers: manifestHeaders(bytes) }), /body digest/)
  assert.throws(() => normalizeDockerHubManifestResponse(bytes, { input, headers: manifestHeaders(bytes, { 'docker-content-digest': `sha256:${'f'.repeat(64)}` }) }), /canonical manifest digest/)
  assert.throws(() => normalizeDockerHubManifestResponse(bytes, { input, headers: manifestHeaders(bytes, { 'content-type': 'application/json' }) }), /unsupported manifest Content-Type/)
  const artifact = stableBytes({ ...indexPayload, artifactType: 'application/example' })
  assert.throws(() => normalizeDockerHubManifestResponse(artifact, { input: { ...input, manifestDigest: digestOf(artifact) }, headers: manifestHeaders(artifact) }), /OCI artifact/)
  const invalidDescriptor = stableBytes({ ...indexPayload, manifests: [{ ...indexPayload.manifests[0], digest: 'sha256:not-a-digest' }] })
  assert.throws(() => normalizeDockerHubManifestResponse(invalidDescriptor, { input: { ...input, manifestDigest: digestOf(invalidDescriptor) }, headers: manifestHeaders(invalidDescriptor) }), /digest changed/)
})

test('marks Registry API or rate header drift for review while preserving a verified manifest', () => {
  const bytes = stableBytes(indexPayload)
  const headers = manifestHeaders(bytes, {
    'docker-distribution-api-version': 'registry/3.0',
    'ratelimit-limit': '100;w=21600',
    'ratelimit-remaining': '99;w=3600',
  })
  const result = normalizeDockerHubManifestResponse(bytes, {
    input: { repository: 'library/alpine', manifestDigest: digestOf(bytes) },
    headers,
  })
  assert.equal(result.conformance.status, 'review-required')
  assert.equal(result.rateLimit, null)
  assert.deepEqual(result.conformance.assertions.filter((entry) => !entry.passed).map((entry) => entry.id), ['registry-v2-api', 'rate-limit-header-contract'])
})

test('uses one anonymous token exchange and one exact manifest GET without credentials, redirects, or retry', async () => {
  const bytes = stableBytes(indexPayload)
  const manifestDigest = digestOf(bytes)
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })
    if (calls.length === 1) {
      const source = JSON.stringify({ token: 'opaque-anonymous-token-value-123456', expires_in: 300 })
      return new Response(source, { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(source)) } })
    }
    return new Response(bytes, { status: 200, headers: manifestHeaders(bytes) })
  }
  const result = await readPublicImageManifestByDigest({ repository: 'library/alpine', manifestDigest }, { fetchImpl })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Falpine%3Apull')
  assert.equal(calls[0].options.headers.authorization, undefined)
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(calls[1].url, `https://registry-1.docker.io/v2/library/alpine/manifests/${manifestDigest}`)
  assert.equal(calls[1].options.headers.accept, ACCEPTED_MANIFEST_MEDIA_TYPES.join(', '))
  assert.equal(calls[1].options.headers.authorization, 'Bearer opaque-anonymous-token-value-123456')
  assert.equal(calls[1].options.redirect, 'error')
  assert.doesNotMatch(JSON.stringify(result), /opaque-anonymous-token/)
})

test('enforces response budgets and exposes not-found, policy, and rate-limit failures without retry', async () => {
  const input = { repository: 'library/alpine', manifestDigest: `sha256:${'a'.repeat(64)}` }
  const token = JSON.stringify({ token: 'opaque-anonymous-token-value-123456', expires_in: 300 })
  for (const [status, code] of [[404, 'not-found'], [403, 'access-policy-blocked'], [429, 'rate-limited']]) {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      if (calls === 1) return new Response(token, { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(token)) } })
      return new Response('{}', { status })
    }
    await assert.rejects(
      () => readPublicImageManifestByDigest(input, { fetchImpl }),
      (error) => error instanceof DockerHubPublicImageManifestError && error.code === code,
    )
    assert.equal(calls, 2)
  }
  let calls = 0
  await assert.rejects(() => readPublicImageManifestByDigest(input, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return new Response(token, { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(token)) } })
      return new Response('{}', {
        status: 200,
        headers: {
          'content-type': indexPayload.mediaType,
          'content-length': String(MAX_MANIFEST_RESPONSE_BYTES + 1),
        },
      })
    },
  }), /response budget/)
  assert.equal(calls, 2)
})

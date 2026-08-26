import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  MAX_JAR_BYTES,
  MavenCentralPublicJarReleaseError,
  normalizeMavenCentralJarRelease,
  readPublicJarReleaseEvidence,
} from '../src/index.mjs'

const bytes = (value) => new TextEncoder().encode(value)
const hash = (algorithm, value) => createHash(algorithm).update(value).digest('hex')
const input = { groupId: 'org.example', artifactId: 'demo-core', version: '1.2.3' }
const pomBytes = bytes(`<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>org.example</groupId><artifactId>demo-core</artifactId><version>1.2.3</version>
  <developers><developer><name>Private Person</name><email>private@example.invalid</email></developer></developers>
</project>`)
const jarBytes = bytes('PK\u0003\u0004bounded-test-jar')
const signatureBytes = bytes('-----BEGIN PGP SIGNATURE-----\nVersion: test\n\nYWJj\n-----END PGP SIGNATURE-----\n')
const payload = {
  pomBytes,
  pomSha1Bytes: bytes(hash('sha1', pomBytes)),
  jarBytes,
  jarSha1Bytes: bytes(hash('sha1', jarBytes)),
  signatureBytes,
}
const headers = {
  pom: new Headers({ 'x-checksum-sha1': hash('sha1', pomBytes) }),
  jar: new Headers({ 'x-checksum-sha1': hash('sha1', jarBytes) }),
}

test('normalizes an exact JAR release and verifies POM/JAR bytes against mandatory SHA-1 sidecars', () => {
  const result = normalizeMavenCentralJarRelease(payload, { input, headers, observedAt: '2026-08-27T00:00:00.000Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.release.gav, 'org.example:demo-core:1.2.3')
  assert.equal(result.release.packaging, 'jar')
  assert.equal(result.release.pomCoordinatesVerified, true)
  assert.deepEqual(result.release.files.map((file) => file.role), ['pom', 'jar', 'jar-signature'])
  assert.equal(result.release.files[1].sha256, hash('sha256', jarBytes))
  assert.equal(result.release.files[2].checksumSource, 'local-only')
  assert.equal(result.release.signatureCryptographicallyVerified, false)
  assert.equal(result.access.httpGetCount, 5)
  assert.doesNotMatch(JSON.stringify(result), /Private Person|private@example|developers/i)
})

test('supports inherited group and version but still requires an exact effective GAV and JAR packaging', () => {
  const inheritedPom = bytes(`<project><modelVersion>4.0.0</modelVersion><parent><groupId>org.example</groupId><artifactId>parent</artifactId><version>1.2.3</version></parent><artifactId>demo-core</artifactId></project>`)
  const inheritedPayload = { ...payload, pomBytes: inheritedPom, pomSha1Bytes: bytes(hash('sha1', inheritedPom)) }
  const inheritedHeaders = { ...headers, pom: new Headers({ 'x-checksum-sha1': hash('sha1', inheritedPom) }) }
  assert.equal(normalizeMavenCentralJarRelease(inheritedPayload, { input, headers: inheritedHeaders }).release.pomCoordinatesVerified, true)
  const warPom = bytes(`<project><modelVersion>4.0.0</modelVersion><groupId>org.example</groupId><artifactId>demo-core</artifactId><version>1.2.3</version><packaging>war</packaging></project>`)
  assert.throws(() => normalizeMavenCentralJarRelease({ ...payload, pomBytes: warPom, pomSha1Bytes: bytes(hash('sha1', warPom)) }, {
    input,
    headers: { ...headers, pom: new Headers({ 'x-checksum-sha1': hash('sha1', warPom) }) },
  }), /packaging is war/)
})

test('rejects aliases, ranges, snapshots, unsafe coordinates, alternate repositories, and unknown fields before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1; throw new Error('must not fetch') }
  const invalid = [
    { ...input, version: 'LATEST' },
    { ...input, version: '[1.0,2.0)' },
    { ...input, version: '1.2.4-SNAPSHOT' },
    { ...input, groupId: 'org/example' },
    { ...input, artifactId: '../demo' },
    { ...input, repository: 'https://evil.invalid' },
  ]
  for (const value of invalid) await assert.rejects(() => readPublicJarReleaseEvidence(value, { fetchImpl }))
  assert.equal(calls, 0)
})

test('rejects POM identity, XML entity, checksum, signature, and repository header drift', () => {
  const wrongPom = bytes(`<project><modelVersion>4.0.0</modelVersion><groupId>org.other</groupId><artifactId>demo-core</artifactId><version>1.2.3</version></project>`)
  assert.throws(() => normalizeMavenCentralJarRelease({ ...payload, pomBytes: wrongPom, pomSha1Bytes: bytes(hash('sha1', wrongPom)) }, {
    input, headers: { ...headers, pom: new Headers({ 'x-checksum-sha1': hash('sha1', wrongPom) }) },
  }), /coordinates/)
  const entityPom = bytes(`<!DOCTYPE project [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><project><modelVersion>4.0.0</modelVersion></project>`)
  assert.throws(() => normalizeMavenCentralJarRelease({ ...payload, pomBytes: entityPom, pomSha1Bytes: bytes(hash('sha1', entityPom)) }, { input, headers }), /unsupported XML/)
  assert.throws(() => normalizeMavenCentralJarRelease({ ...payload, jarSha1Bytes: bytes('0'.repeat(40)) }, { input, headers }), /does not match/)
  assert.throws(() => normalizeMavenCentralJarRelease({ ...payload, signatureBytes: bytes('not a signature') }, { input, headers }), /signature armor/)
  const reviewed = normalizeMavenCentralJarRelease(payload, { input, headers: { ...headers, jar: new Headers() } })
  assert.equal(reviewed.conformance.status, 'review-required')
  assert.deepEqual(reviewed.conformance.assertions.filter((entry) => !entry.passed).map((entry) => entry.id), ['repository-sha1-headers'])
})

test('uses exactly five fixed anonymous GETs in Maven repository-layout order without redirects or retry', async () => {
  const bodies = [
    [pomBytes, 'text/xml', { 'x-checksum-sha1': hash('sha1', pomBytes) }],
    [payload.pomSha1Bytes, 'text/plain', {}],
    [jarBytes, 'application/java-archive', { 'x-checksum-sha1': hash('sha1', jarBytes) }],
    [payload.jarSha1Bytes, 'text/plain', {}],
    [signatureBytes, 'text/plain', {}],
  ]
  const calls = []
  const fetchImpl = async (url, options) => {
    const [body, contentType, extra] = bodies[calls.length]
    calls.push({ url: String(url), options })
    return new Response(body, { status: 200, headers: { 'content-type': contentType, 'content-length': String(body.byteLength), ...extra } })
  }
  const result = await readPublicJarReleaseEvidence(input, { fetchImpl })
  assert.equal(calls.length, 5)
  assert.deepEqual(calls.map((call) => call.url), [
    'https://repo.maven.apache.org/maven2/org/example/demo-core/1.2.3/demo-core-1.2.3.pom',
    'https://repo.maven.apache.org/maven2/org/example/demo-core/1.2.3/demo-core-1.2.3.pom.sha1',
    'https://repo.maven.apache.org/maven2/org/example/demo-core/1.2.3/demo-core-1.2.3.jar',
    'https://repo.maven.apache.org/maven2/org/example/demo-core/1.2.3/demo-core-1.2.3.jar.sha1',
    'https://repo.maven.apache.org/maven2/org/example/demo-core/1.2.3/demo-core-1.2.3.jar.asc',
  ])
  assert.equal(calls.every((call) => call.options.method === 'GET' && call.options.redirect === 'error' && call.options.headers.authorization === undefined), true)
  assert.doesNotMatch(JSON.stringify(result), /private@example/)
})

test('enforces bounded content types and sizes', async () => {
  let calls = 0
  await assert.rejects(() => readPublicJarReleaseEvidence(input, {
    fetchImpl: async () => {
      calls += 1
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  }), /returned application\/json/)
  assert.equal(calls, 1)
  calls = 0
  await assert.rejects(() => readPublicJarReleaseEvidence(input, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return new Response(pomBytes, { status: 200, headers: { 'content-type': 'text/xml', 'content-length': String(pomBytes.byteLength), 'x-checksum-sha1': hash('sha1', pomBytes) } })
      if (calls === 2) return new Response(payload.pomSha1Bytes, { status: 200, headers: { 'content-type': 'text/plain', 'content-length': '40' } })
      return new Response('', { status: 200, headers: { 'content-type': 'application/java-archive', 'content-length': String(MAX_JAR_BYTES + 1) } })
    },
  }), /response budget/)
  assert.equal(calls, 3)
})

test('exposes missing, policy, and rate-limit failures with phase and without retry', async () => {
  for (const [status, code] of [[404, 'not-found'], [403, 'access-policy-blocked'], [429, 'rate-limited']]) {
    let calls = 0
    await assert.rejects(
      () => readPublicJarReleaseEvidence(input, { fetchImpl: async () => { calls += 1; return new Response('{}', { status }) } }),
      (error) => error instanceof MavenCentralPublicJarReleaseError && error.code === code && error.phase === 'POM',
    )
    assert.equal(calls, 1)
  }
})

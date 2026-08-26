import assert from 'node:assert/strict'
import test from 'node:test'
import { GoPublicModuleVersionError, MAX_ARCHIVE_BYTES, escapeGoProxyElement, goModH1, normalizeGoPublicModuleVersion, readAuthenticatedPublicModuleVersion } from '../src/index.mjs'

const input = { modulePath: 'rsc.io/quote', version: 'v1.5.2', publicModuleAcknowledged: true }
const infoContent = Buffer.from('{"Version":"v1.5.2","Time":"2018-02-14T15:44:20Z"}')
const goModContent = Buffer.from('module "rsc.io/quote"\n\nrequire "rsc.io/sampler" v1.3.0\n')
const moduleTreeH1 = 'h1:w5fcysjrx7yqtD/aO+QwRjYZOKnaM9Uh2b40tElTs3Y='

function raw(overrides = {}) {
  return {
    goVersion: 'go1.24.2',
    ephemeralCacheRemoved: true,
    infoContent,
    goModContent,
    download: { Path: input.modulePath, Version: input.version, Sum: moduleTreeH1, GoModSum: goModH1(goModContent) },
    ...overrides,
  }
}

const preflight = { archiveSizeBytes: 2987, delivery: 'direct', archiveEtag: '"fixture"', cacheControl: 'public, max-age=10800' }

test('normalizes authenticated module and go.mod evidence without local cache paths', () => {
  const result = normalizeGoPublicModuleVersion(raw(), { input, preflight, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.moduleVersion.moduleTreeH1, moduleTreeH1)
  assert.equal(result.moduleVersion.goMod.h1, 'h1:LzX7hefJvL54yjefDEDHNONDjII0t9xZLPXsUe+TKr0=')
  assert.equal(result.authentication.status, 'authenticated')
  assert.equal(result.transfer.archiveExecuted, false)
  assert.doesNotMatch(JSON.stringify(result), /\/tmp\/|module-cache|"Info"|"GoMod"|"Zip"|"Dir"/)
})

test('requires exact versions and explicit public-module acknowledgement before network access', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readAuthenticatedPublicModuleVersion({ ...input, version: 'latest' }, { fetchImpl }), /exact canonical/)
  await assert.rejects(() => readAuthenticatedPublicModuleVersion({ ...input, publicModuleAcknowledged: false }, { fetchImpl }), /must be true/)
  await assert.rejects(() => readAuthenticatedPublicModuleVersion({ ...input, modulePath: '../private' }, { fetchImpl }), /public Go module path/)
  assert.equal(calls, 0)
})

test('uses Go case encoding and performs one bounded HEAD before the authenticated download', async () => {
  assert.equal(escapeGoProxyElement('example.com/Upper'), 'example.com/!upper')
  let requestedUrl
  let requestedMethod
  let downloads = 0
  const fetchImpl = async (url, options) => {
    requestedUrl = String(url)
    requestedMethod = options.method
    return new Response(null, { status: 200, headers: { 'content-type': 'application/zip', 'content-length': '2987' } })
  }
  const result = await readAuthenticatedPublicModuleVersion(input, { fetchImpl, downloadImpl: async () => { downloads += 1; return raw() }, now: () => new Date('2026-08-27T00:00:00Z') })
  assert.equal(requestedMethod, 'HEAD')
  assert.match(requestedUrl, /rsc\.io\/quote\/@v\/v1\.5\.2\.zip$/)
  assert.equal(downloads, 1)
  assert.equal(result.transfer.archiveSizeBytes, 2987)
  assert.equal(result.transfer.delivery, 'direct')
})

test('allows one official signed storage redirect without exposing its URL', async () => {
  const calls = []
  const storageUrl = 'https://storage.googleapis.com/proxy-golang-org-prod/archive.zip?Expires=1&GoogleAccessId=proxy%40example&Signature=signed'
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), redirect: options.redirect })
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: storageUrl } })
    return new Response(null, { status: 200, headers: { 'content-type': 'application/zip', 'content-length': '2987' } })
  }
  const result = await readAuthenticatedPublicModuleVersion(input, { fetchImpl, downloadImpl: async () => raw() })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].redirect, 'manual')
  assert.equal(calls[1].redirect, 'error')
  assert.equal(result.transfer.delivery, 'official-storage-redirect')
  assert.doesNotMatch(JSON.stringify(result), /GoogleAccessId|Signature=signed/)
})

test('rejects redirects outside the official signed Go proxy storage origin', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(null, { status: 302, headers: { location: 'https://evil.example/archive.zip?Expires=1&GoogleAccessId=x&Signature=y' } })
  }
  await assert.rejects(() => readAuthenticatedPublicModuleVersion(input, { fetchImpl, downloadImpl: async () => raw() }), /escaped the official signed storage origin/)
  assert.equal(calls, 1)
})

test('rejects missing or oversized archive lengths without downloading', async () => {
  let downloads = 0
  const downloadImpl = async () => { downloads += 1; return raw() }
  const missingLength = async () => new Response(null, { status: 200, headers: { 'content-type': 'application/zip' } })
  await assert.rejects(() => readAuthenticatedPublicModuleVersion(input, { fetchImpl: missingLength, downloadImpl }), /bounded content length/)
  const oversized = async () => new Response(null, { status: 200, headers: { 'content-type': 'application/zip', 'content-length': String(MAX_ARCHIVE_BYTES + 1) } })
  await assert.rejects(() => readAuthenticatedPublicModuleVersion(input, { fetchImpl: oversized, downloadImpl }), /transfer budget/)
  assert.equal(downloads, 0)
})

test('rejects identity, module directive, and authenticated go.mod checksum drift', () => {
  assert.throws(() => normalizeGoPublicModuleVersion(raw({ download: { ...raw().download, Path: 'example.com/wrong' } }), { input, preflight }), /identity drifted/)
  assert.throws(() => normalizeGoPublicModuleVersion(raw({ goModContent: Buffer.from('module example.com/wrong\n') }), { input, preflight }), /module directive/)
  assert.throws(() => normalizeGoPublicModuleVersion(raw({ download: { ...raw().download, GoModSum: 'h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } }), { input, preflight }), /does not match/)
})

test('exposes public proxy rate limits as typed non-retryable errors', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(null, { status: 429, headers: { 'retry-after': '120' } })
  }
  await assert.rejects(
    () => readAuthenticatedPublicModuleVersion(input, { fetchImpl, now: () => new Date('2026-08-27T00:00:00Z') }),
    (error) => error instanceof GoPublicModuleVersionError && error.code === 'rate-limited' && error.retryAt === '2026-08-27T00:02:00.000Z',
  )
  assert.equal(calls, 1)
})

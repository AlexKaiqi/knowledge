import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_PACKAGE_BYTES,
  NuGetOrgPublicPackageVersionError,
  readPublicPackageVersionEvidence,
} from '../src/index.mjs'

const input = { packageId: 'Example.Package', version: '1.2.3' }
const packageUrl = 'https://api.nuget.org/v3-flatcontainer/example.package/1.2.3/example.package.1.2.3.nupkg'

function zipFixture() {
  const names = ['Example.Package.nuspec', '.signature.p7s']
  const localParts = []
  const centralParts = []
  let localOffset = 0
  for (const [index, name] of names.entries()) {
    const nameBytes = Buffer.from(name)
    const body = Buffer.from(index === 0 ? '<package />' : 'signature')
    const local = Buffer.alloc(30 + nameBytes.length + body.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    body.copy(local, 30 + nameBytes.length)
    localParts.push(local)
    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(localOffset, 42)
    nameBytes.copy(central, 46)
    centralParts.push(central)
    localOffset += local.length
  }
  const central = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(localOffset, 16)
  return Buffer.concat([...localParts, central, eocd])
}

function serviceIndex() {
  return {
    version: '3.0.0',
    resources: [
      { '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/', '@type': 'RegistrationsBaseUrl/3.6.0' },
      { '@id': 'https://api.nuget.org/v3-flatcontainer/', '@type': 'PackageBaseAddress/3.0.0' },
    ],
  }
}

function registration(overrides = {}) {
  return {
    count: 1,
    items: [{
      '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/example.package/page/1.0.0/2.0.0.json',
      count: 1,
      lower: '1.0.0',
      upper: '2.0.0',
      items: [{
        catalogEntry: {
          id: 'Example.Package',
          version: '1.2.3',
          listed: true,
          published: '2026-08-27T00:00:00Z',
          licenseExpression: 'MIT',
          authors: 'Private Person',
          vulnerabilities: [{ severity: '2', advisoryUrl: 'https://example.invalid/private-detail' }],
          ...overrides,
        },
        packageContent: packageUrl,
      }],
    }],
  }
}

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', ...init.headers }, ...init })
}

test('reads exact registration metadata and hashes a bounded signed package without personal fields', async () => {
  const archive = zipFixture()
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(String(url))
    if (String(url).endsWith('/v3/index.json')) return jsonResponse(serviceIndex())
    if (String(url).endsWith('/example.package/index.json')) return jsonResponse(registration())
    if (String(url) === packageUrl) return new Response(archive, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
    throw new Error(`unexpected URL ${url}`)
  }
  const result = await readPublicPackageVersionEvidence(input, { fetchImpl, now: () => new Date('2026-08-27T00:00:00Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.packageVersion.id, 'Example.Package')
  assert.equal(result.packageVersion.artifact.entryCount, 2)
  assert.equal(result.packageVersion.artifact.signaturePresent, true)
  assert.equal(result.packageVersion.artifact.signatureCryptographicallyVerified, false)
  assert.deepEqual(result.packageVersion.vulnerabilities, { total: 1, bySeverity: { low: 0, moderate: 0, high: 1, critical: 0 } })
  assert.equal(JSON.stringify(result).includes('Private Person'), false)
  assert.equal(JSON.stringify(result).includes('private-detail'), false)
  assert.deepEqual(urls, ['https://api.nuget.org/v3/index.json', 'https://api.nuget.org/v3/registration5-gz-semver2/example.package/index.json', packageUrl])
})

test('follows only one path-preserving official China route redirect', async () => {
  const archive = zipFixture()
  const fetchImpl = async (url) => {
    const value = new URL(url)
    if (value.origin === 'https://api.nuget.org') return new Response('', { status: 302, headers: { location: `https://nuget.azure.cn${value.pathname}${value.search}` } })
    if (value.pathname === '/v3/index.json') return jsonResponse(serviceIndex())
    if (value.pathname.endsWith('/example.package/index.json')) return jsonResponse(registration())
    return new Response(archive, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
  }
  const result = await readPublicPackageVersionEvidence(input, { fetchImpl })
  assert.equal(result.access.logicalGetCount, 3)
  assert.equal(result.access.transportGetCount, 6)
  assert.equal(result.access.redirectCount, 3)
  assert.deepEqual(result.access.transportOrigins, ['https://api.nuget.org', 'https://nuget.azure.cn'])
})

test('fetches a discovered non-inlined registration page', async () => {
  const archive = zipFixture()
  const pageUrl = 'https://api.nuget.org/v3/registration5-gz-semver2/example.package/page/1.0.0/2.0.0.json'
  const index = registration()
  delete index.items[0].items
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/v3/index.json')) return jsonResponse(serviceIndex())
    if (String(url).endsWith('/example.package/index.json')) return jsonResponse(index)
    if (String(url) === pageUrl) return jsonResponse({ count: 1, items: registration().items[0].items })
    return new Response(archive, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
  }
  const result = await readPublicPackageVersionEvidence(input, { fetchImpl })
  assert.equal(result.access.logicalGetCount, 4)
})

test('rejects ranges, non-normalized versions, invalid IDs and unknown inputs before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicPackageVersionEvidence({ packageId: 'Example.Package', version: '[1.0,2.0)' }, { fetchImpl }), /exact normalized/)
  await assert.rejects(() => readPublicPackageVersionEvidence({ packageId: 'Example.Package', version: '1.2' }, { fetchImpl }), /exact normalized/)
  await assert.rejects(() => readPublicPackageVersionEvidence({ packageId: '../private', version: '1.2.3' }, { fetchImpl }), /package ID subset/)
  await assert.rejects(() => readPublicPackageVersionEvidence({ ...input, source: 'https://evil.example' }, { fetchImpl }), /unknown input fields/)
  assert.equal(calls, 0)
})

test('rejects redirect escape, identity drift, signature absence and package over budget', async () => {
  await assert.rejects(() => readPublicPackageVersionEvidence(input, { fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://evil.example/v3/index.json' } }) }), /escaped the allowed official route/)
  const cases = [
    { registration: registration({ id: 'Other.Package' }), archive: zipFixture(), pattern: /identity changed/ },
    { registration: registration(), archive: Buffer.from('not a zip'), pattern: /bounded ZIP archive/ },
  ]
  for (const scenario of cases) {
    const fetchImpl = async (url) => {
      if (String(url).endsWith('/v3/index.json')) return jsonResponse(serviceIndex())
      if (String(url).endsWith('/example.package/index.json')) return jsonResponse(scenario.registration)
      return new Response(scenario.archive, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
    }
    await assert.rejects(() => readPublicPackageVersionEvidence(input, { fetchImpl }), scenario.pattern)
  }
  const tooLarge = async (url) => {
    if (String(url).endsWith('/v3/index.json')) return jsonResponse(serviceIndex())
    if (String(url).endsWith('/example.package/index.json')) return jsonResponse(registration())
    return new Response('', { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': String(MAX_PACKAGE_BYTES + 1) } })
  }
  await assert.rejects(() => readPublicPackageVersionEvidence(input, { fetchImpl: tooLarge }), /response budget/)
})

test('exposes rate limiting and not-found phases without retry', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response('', { status: 429, headers: { 'retry-after': '60' } })
  }
  await assert.rejects(
    () => readPublicPackageVersionEvidence(input, { fetchImpl }),
    (error) => error instanceof NuGetOrgPublicPackageVersionError && error.code === 'rate-limited' && error.phase === 'service-index' && error.retryAfter === '60',
  )
  assert.equal(calls, 1)
})

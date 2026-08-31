import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPublicAddress,
  auditStoreAiReadiness,
  normalizePublicDomain,
  normalizeRadarAudit,
  validatePublicHttpsUrl,
} from '../src/index.mjs'

const upstreamReport = {
  schema_version: '0.3',
  domain: 'shop.example.com',
  score: 75,
  findings: [{ id: 'llms.missing', severity: 'warn', message: 'No llms.txt found.', evidence: 'dropped' }],
  bots: [{ bot: 'GPTBot', vendor: 'OpenAI', access: 'allowed', via: 'wildcard' }],
  categories: [
    { id: 'robots', label: 'AI crawler access', weight: 40, earned: 40 },
    { id: 'structured', label: 'Structured data', weight: 25, earned: 20 },
    { id: 'llms', label: 'llms.txt', weight: 15, earned: 0 },
    { id: 'meta', label: 'Meta basics', weight: 15, earned: 10 },
    { id: 'sitemap', label: 'Sitemap', weight: 5, earned: 5 },
  ],
}

test('normalizes a free readiness audit without leaking runtime or claiming visibility', () => {
  const result = normalizeRadarAudit(upstreamReport, { domain: 'shop.example.com', observedAt: '2026-08-31T15:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.readiness.score, 75)
  assert.equal(result.measurement.aiEngineCalls, false)
  assert.equal(result.measurement.apiCost, 0)
  assert.equal(result.measurement.recommendationVisibilityMeasured, false)
  assert.equal('evidence' in result.findings[0], false)
  assert.equal(JSON.stringify(result).includes('acceptedCommit'), false)
})

test('runs the reviewed Radar core through an injected safe fetch surface', async () => {
  let receivedDomain
  let receivedFetcher
  const radar = {
    packageVersion: '0.3.0',
    createFetcher: (options) => ({ marker: 'safe', options }),
    runAudit: async (domain, options) => {
      receivedDomain = domain
      receivedFetcher = options.fetcher
      return upstreamReport
    },
  }
  const fetchImpl = async () => { throw new Error('not called by fixture') }
  const result = await auditStoreAiReadiness({ domain: 'shop.example.com' }, { radar, fetchImpl, now: () => new Date('2026-08-31T15:00:00Z') })
  assert.equal(receivedDomain, 'shop.example.com')
  assert.equal(receivedFetcher.marker, 'safe')
  assert.equal(receivedFetcher.options.fetchImpl, fetchImpl)
  assert.equal(result.domain, 'shop.example.com')
})

test('rejects URL components, local names, IP literals, and unknown inputs before execution', async () => {
  for (const domain of ['https://example.com', 'example.com/path', 'localhost', '127.0.0.1', '[::1]', 'user@example.com']) {
    assert.throws(() => normalizePublicDomain(domain), /domain|hostname|DNS/)
  }
  let runs = 0
  const radar = { packageVersion: '0.3.0', createFetcher: () => ({}), runAudit: async () => { runs += 1 } }
  await assert.rejects(() => auditStoreAiReadiness({ domain: 'example.com', url: 'https://internal' }, { radar }), /unknown input fields/)
  assert.equal(runs, 0)
})

test('blocks private and reserved DNS answers and unsafe redirect URLs', () => {
  for (const address of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) {
    assert.throws(() => assertPublicAddress(address), /private|reserved/)
  }
  assert.deepEqual(assertPublicAddress('8.8.8.8'), { address: '8.8.8.8', family: 4 })
  assert.equal(validatePublicHttpsUrl('https://example.com/path').hostname, 'example.com')
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com:8443', 'https://127.0.0.1']) {
    assert.throws(() => validatePublicHttpsUrl(url), /HTTPS|hostname|DNS/)
  }
})

test('fails closed on upstream schema, identity, score, category, or bot drift', () => {
  assert.throws(() => normalizeRadarAudit({ ...upstreamReport, schema_version: '0.4' }, { domain: 'shop.example.com' }), /schema version/)
  assert.throws(() => normalizeRadarAudit({ ...upstreamReport, domain: 'other.example.com' }, { domain: 'shop.example.com' }), /identity/)
  assert.throws(() => normalizeRadarAudit({ ...upstreamReport, score: null }, { domain: 'shop.example.com' }), /score/)
  assert.throws(() => normalizeRadarAudit({ ...upstreamReport, categories: upstreamReport.categories.slice(0, 4) }, { domain: 'shop.example.com' }), /collection shape/)
  assert.throws(() => normalizeRadarAudit({ ...upstreamReport, bots: [{ ...upstreamReport.bots[0], access: 'unknown' }] }, { domain: 'shop.example.com' }), /bot access/)
})

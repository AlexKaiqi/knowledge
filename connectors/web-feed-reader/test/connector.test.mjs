import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RESPONSE_BYTES, normalizeRegisteredPublicFeed, parseFeedDocument, readRegisteredPublicFeed, WebFeedReaderError } from '../src/index.mjs'

const rss = ({ title = 'Node.js Blog: Releases', link = 'https://nodejs.org/en', itemLink = 'https://nodejs.org/en/blog/release/v24.20.0', buildDate = 'Wed, 26 Aug 2026 22:30:14 GMT', extra = '' } = {}) => `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>${title}</title><link>${link}</link><language>en</language><lastBuildDate>${buildDate}</lastBuildDate>
<item><title><![CDATA[Node.js 24.20.0 (LTS)]]></title><link>${itemLink}</link><guid isPermaLink="false">/blog/release/v24.20.0?1787754582505</guid><pubDate>Wed, 26 Aug 2026 14:29:42 GMT</pubDate><author>person@example.com</author><description>excluded body</description><enclosure url="https://example.com/a.mp3" /></item>${extra}</channel></rss>`

test('normalizes the registered Node.js RSS feed and excludes people and full content', () => {
  const result = normalizeRegisteredPublicFeed(rss(), { input: { feedId: 'nodejs-releases', limit: 1 }, transport: { contentType: 'application/xml', receivedBytes: 800, documentSha256: 'a'.repeat(64), etag: '"fixture"' } })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.source.feedUrl, 'https://nodejs.org/en/feed/releases.xml')
  assert.equal(result.entries[0].title, 'Node.js 24.20.0 (LTS)')
  assert.equal(result.entries[0].publishedAt, '2026-08-26T14:29:42.000Z')
  assert.equal(result.coverage.returnedComplete, true)
  assert.equal(JSON.stringify(result).includes('person@example.com'), false)
  assert.equal(JSON.stringify(result).includes('excluded body'), false)
})

test('keeps build time observable without treating it as a semantic feed change', () => {
  const first = normalizeRegisteredPublicFeed(rss(), { input: { feedId: 'nodejs-releases' } })
  const rebuilt = normalizeRegisteredPublicFeed(rss({ buildDate: 'Wed, 26 Aug 2026 22:46:49 GMT' }), { input: { feedId: 'nodejs-releases' } })
  assert.notEqual(first.feed.updatedAt, rebuilt.feed.updatedAt)
  assert.notEqual(first.feed.documentSha256, rebuilt.feed.documentSha256)
  assert.equal(first.feed.feedDigest, rebuilt.feed.feedDigest)
})

test('strict parser supports Atom 1.0 without exposing person or content constructs', () => {
  const parsed = parseFeedDocument(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Example</title><id>urn:example</id><updated>2026-08-26T10:00:00Z</updated><link rel="alternate" href="https://example.com/"/><author><name>Excluded Person</name></author><entry><title>Entry</title><id>urn:entry:1</id><updated>2026-08-26T11:00:00Z</updated><link href="https://example.com/entry"/><content>Excluded content</content></entry></feed>`)
  assert.equal(parsed.format, 'atom-1.0')
  assert.deepEqual(parsed.entries, [{ id: 'urn:entry:1', title: 'Entry', url: 'https://example.com/entry', publishedAt: null, updatedAt: '2026-08-26T11:00:00.000Z' }])
  assert.equal(JSON.stringify(parsed).includes('Excluded Person'), false)
  assert.equal(JSON.stringify(parsed).includes('Excluded content'), false)
})

test('rejects DTDs, duplicate identities, markup titles, and entries outside the reviewed origin', () => {
  assert.throws(() => parseFeedDocument(`<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY x "bad">]><rss version="2.0"><channel><title>x</title></channel></rss>`), /DOCTYPE/)
  const duplicate = '<item><title>Again</title><link>https://nodejs.org/en/blog/release/v24.20.1</link><guid>/blog/release/v24.20.0?1787754582505</guid><pubDate>Wed, 26 Aug 2026 15:00:00 GMT</pubDate></item>'
  assert.throws(() => parseFeedDocument(rss({ extra: duplicate })), /identifiers must be unique/)
  assert.throws(() => normalizeRegisteredPublicFeed(rss({ itemLink: 'https://example.com/release' }), { input: { feedId: 'nodejs-releases' } }), /escaped its reviewed origin/)
  assert.throws(() => parseFeedDocument(rss({ title: '<![CDATA[<b>Node.js Blog: Releases</b>]]>' })), /contains markup/)
})

test('uses one fixed request, rejects arbitrary URLs, and does not retry errors', async () => {
  let calls = 0
  const fetchImpl = async (url, options) => {
    calls += 1
    assert.equal(url, 'https://nodejs.org/en/feed/releases.xml')
    assert.equal(options.redirect, 'error')
    return new Response(rss(), { status: 200, headers: { 'content-type': 'application/xml', etag: '"fixture"' } })
  }
  assert.equal((await readRegisteredPublicFeed({ feedId: 'nodejs-releases', limit: 1 }, { fetchImpl })).entries.length, 1)
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'nodejs-releases', url: 'https://example.com/feed' }, { fetchImpl }), /unknown input/)
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'unknown' }, { fetchImpl }), /registered public feed/)
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'nodejs-releases' }, { fetchImpl: async () => { calls += 1; return new Response('', { status: 429, headers: { 'retry-after': '60' } }) }, now: () => new Date('2026-08-27T00:00:00Z') }), (error) => error instanceof WebFeedReaderError && error.code === 'rate-limited' && error.retryAt === '2026-08-27T00:01:00.000Z')
  assert.equal(calls, 2)
})

test('enforces content type, response bytes, entry count, and caller limits', async () => {
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'nodejs-releases' }, { fetchImpl: async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }) }), /returned text\/html/)
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'nodejs-releases' }, { fetchImpl: async () => new Response('', { headers: { 'content-type': 'application/xml', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }) }), /512 KiB/)
  await assert.rejects(() => readRegisteredPublicFeed({ feedId: 'nodejs-releases', limit: 21 }, { fetchImpl: async () => {} }), /between 1 and 20/)
  const items = Array.from({ length: 1001 }, (_, index) => `<item><title>Node.js ${index}.0.0</title><link>https://nodejs.org/en/blog/release/v${index}.0.0</link><guid>${index}</guid><pubDate>Wed, 26 Aug 2026 14:29:42 GMT</pubDate></item>`).join('')
  assert.throws(() => parseFeedDocument(rss({ extra: items })), /more than 1000 entries/)
})

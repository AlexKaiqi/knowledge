import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchQuery, normalizeAtomResponse, normalizeInput, searchPublicEprintMetadata, ArxivMetadataSearchError } from '../src/index.mjs'

const input = { query: 'personal assistant', field: 'all', category: 'cs.AI', sortBy: 'submittedDate', sortOrder: 'descending', start: 0, limit: 2 }
const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <id>https://arxiv.org/api/example</id><title>query</title><updated>2026-08-27T03:00:00Z</updated>
  <link href="https://arxiv.org/api/query?search_query=all:test&amp;start=0&amp;max_results=2" type="application/atom+xml"/>
  <opensearch:itemsPerPage>2</opensearch:itemsPerPage><opensearch:totalResults>3</opensearch:totalResults><opensearch:startIndex>0</opensearch:startIndex>
  <entry><id>http://arxiv.org/abs/2608.22266v2</id><title>Proactive Personal Assistants</title><updated>2026-08-26T06:46:20Z</updated><published>2026-08-23T07:54:31Z</published><summary>Evidence about proactive clarification and user expertise.</summary><link href="https://arxiv.org/abs/2608.22266v2" rel="alternate" type="text/html"/><link href="https://arxiv.org/pdf/2608.22266v2" rel="related" type="application/pdf" title="pdf"/><category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/><category term="cs.HC" scheme="http://arxiv.org/schemas/atom"/><arxiv:primary_category term="cs.AI"/><arxiv:comment>Accepted paper</arxiv:comment><author><name>Alice Example</name></author><author><name>Bob Example</name></author></entry>
  <entry><id>http://arxiv.org/abs/2608.11111v1</id><title>Companion Agent Evaluation</title><updated>2026-08-20T00:00:00Z</updated><published>2026-08-20T00:00:00Z</published><summary>Evaluation of companion agents under bounded tasks.</summary><link href="https://arxiv.org/abs/2608.11111v1" rel="alternate" type="text/html"/><link href="https://arxiv.org/pdf/2608.11111v1" rel="related" type="application/pdf" title="pdf"/><category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/><arxiv:primary_category term="cs.AI"/><author><name>Carol Example</name></author></entry>
</feed>`

test('builds only a bounded phrase/category query', () => {
  assert.equal(buildSearchQuery(input), 'all:"personal assistant" AND cat:cs.AI')
  assert.deepEqual(normalizeInput(input), input)
  assert.throws(() => normalizeInput({ ...input, query: 'x OR all:*' }), ArxivMetadataSearchError)
  assert.throws(() => normalizeInput({ ...input, limit: 21 }), /limit/)
  assert.throws(() => normalizeInput({ ...input, endpoint: 'https://example.com' }), /unknown input fields/)
})

test('normalizes Atom metadata and preserves offset uncertainty', () => {
  const result = normalizeAtomResponse(atom, { input, collectedAt: '2026-08-27T03:01:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.entries.length, 2)
  assert.equal(result.entries[0].arxivId, '2608.22266v2')
  assert.deepEqual(result.entries[0].authors, ['Alice Example', 'Bob Example'])
  assert.equal(result.coverage.corpusComplete, false)
  assert.equal(result.coverage.checkpointSemantics, 'offset-is-not-stable-delta')
  assert.equal(result.coverage.contentFilesRetained, false)
  assert.equal(JSON.stringify(result).includes('export.arxiv.org/api/query'), false)
})

test('rejects XML entities, identity drift, unsafe links and wrong ordering', () => {
  assert.throws(() => normalizeAtomResponse(`<!DOCTYPE feed [<!ENTITY x "bad">]>${atom}`, { input }), /doctype/)
  assert.throws(() => normalizeAtomResponse(atom.replace('<opensearch:startIndex>0', '<opensearch:startIndex>1'), { input }), /requested bounds/)
  assert.throws(() => normalizeAtomResponse(atom.replace('https://arxiv.org/abs/2608.22266v2', 'https://example.com/abs/2608.22266v2'), { input }), /escaped arXiv/)
  const wrongOrder = atom.replace('2026-08-20T00:00:00Z</updated><published>2026-08-20T00:00:00Z', '2026-08-27T00:00:00Z</updated><published>2026-08-27T00:00:00Z')
  assert.equal(normalizeAtomResponse(wrongOrder, { input }).conformance.status, 'review-required')
})

test('uses one fixed endpoint, serializes calls and never retries', async () => {
  const calls = []
  const waits = []
  let clock = 10_000
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })
    return new Response(atom, { status: 200, headers: { 'content-type': 'application/atom+xml' } })
  }
  const options = { fetchImpl, clock: () => clock, sleep: async (milliseconds) => { waits.push(milliseconds); clock += milliseconds }, now: () => new Date('2026-08-27T03:01:00Z') }
  await searchPublicEprintMetadata(input, options)
  await searchPublicEprintMetadata(input, options)
  assert.equal(calls.length, 2)
  assert.deepEqual(waits, [3000])
  const url = new URL(calls[0].url)
  assert.equal(url.origin + url.pathname, 'https://export.arxiv.org/api/query')
  assert.equal(url.searchParams.get('search_query'), 'all:"personal assistant" AND cat:cs.AI')
  assert.equal(url.searchParams.get('max_results'), '2')
  assert.equal(calls[0].options.redirect, 'error')

  let failures = 0
  clock += 3000
  await assert.rejects(() => searchPublicEprintMetadata(input, { ...options, fetchImpl: async () => { failures += 1; return new Response('busy', { status: 503, headers: { 'content-type': 'text/plain' } }) } }), /HTTP_503/)
  assert.equal(failures, 1)
})

test('enforces the streaming response budget and content type', async () => {
  let clock = 1_000_000
  await assert.rejects(() => searchPublicEprintMetadata(input, {
    clock: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds },
    maxResponseBytes: 128,
    fetchImpl: async () => new Response(atom, { status: 200, headers: { 'content-type': 'application/atom+xml' } }),
  }), /exceeds 128 bytes/)
})

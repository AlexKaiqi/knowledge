import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RESPONSE_BYTES, TIKTOK_ORIGIN, TikTokPublicVideoEmbedError, normalizePublicVideoEmbedResponse, readPublicVideoEmbed } from '../src/index.mjs'

const input = { videoUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' }
function payload(overrides = {}) {
  return {
    version: '1.0', type: 'video', title: 'Scramble up ur name', author_url: 'https://www.tiktok.com/@scout2015',
    author_name: 'excluded', width: '100%', height: '100%', html: '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@scout2015/video/6718335390845095173" data-video-id="6718335390845095173"></blockquote>',
    thumbnail_url: 'https://p16.example/secret.jpeg', thumbnail_width: 576, thumbnail_height: 1024,
    provider_url: 'https://www.tiktok.com', provider_name: 'TikTok', ...overrides,
  }
}

test('normalizes a public descriptor while excluding identity, HTML, URLs, metrics, and raw payload', () => {
  const result = normalizePublicVideoEmbedResponse(payload(), { input, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.videoEmbed, { videoId: '6718335390845095173', canonicalUrl: input.videoUrl, title: 'Scramble up ur name', thumbnailWidth: 576, thumbnailHeight: 1024 })
  const serialized = JSON.stringify(result)
  for (const excluded of ['author_name', '<blockquote', 'p16.example', 'thumbnail_url']) assert.equal(serialized.includes(excluded), false)
})

test('rejects noncanonical, mismatched, or unsafe video identities before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  for (const videoUrl of ['https://vm.tiktok.com/abc', 'https://www.tiktok.com/@scout2015/video/6718335390845095173?x=1', 'https://evil.example/@scout2015/video/6718335390845095173']) {
    await assert.rejects(() => readPublicVideoEmbed({ videoUrl }, { fetchImpl }), /canonical TikTok|must match/)
  }
  await assert.rejects(() => readPublicVideoEmbed({ ...input, baseUrl: 'https://evil.example' }, { fetchImpl }), /unknown input fields/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ author_url: 'https://www.tiktok.com/@other' }), { input }), /author identity/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ html: '<blockquote data-video-id="1"></blockquote>' }), { input }), /HTML identity/)
  assert.equal(calls, 0)
})

test('uses one fixed official request without redirects or retry', async () => {
  let request
  const result = await readPublicVideoEmbed(input, { fetchImpl: async (url, options) => { request = { url, options }; return new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json' } }) }, now: () => new Date('2026-08-27T00:00:00Z') })
  assert.equal(result.videoEmbed.videoId, '6718335390845095173')
  assert.equal(request.url.origin, TIKTOK_ORIGIN)
  assert.equal(request.url.pathname, '/oembed')
  assert.equal(request.url.searchParams.get('url'), input.videoUrl)
  assert.equal(request.options.redirect, 'error')
})

test('enforces response shape and budget and distinguishes platform failures', async () => {
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ provider_name: 'Other' }), { input }), /provider contract/)
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) }), /text\/html/)
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }) }), /128 KiB/)
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl: async () => new Response('{}', { status: 404 }) }), (error) => error instanceof TikTokPublicVideoEmbedError && error.code === 'platform-rejected')
})

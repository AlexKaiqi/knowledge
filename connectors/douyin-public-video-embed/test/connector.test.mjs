import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DOUYIN_OPEN_API_ORIGIN,
  DouyinPublicVideoEmbedError,
  MAX_RESPONSE_BYTES,
  normalizePublicVideoEmbedResponse,
  readPublicVideoEmbed,
} from '../src/index.mjs'

const input = { videoId: '7601036371859459343' }

function payload(overrides = {}) {
  return {
    data: {
      iframe_code: '<iframe width="1080" height="1920" src="https://open.douyin.com/player/video?vid=7601036371859459343&autoplay=0"></iframe>',
      video_height: 1920,
      video_title: '#中国机器人突破感知极限',
      video_width: 1080,
      author: { uid: 'excluded' },
      statistics: { digg_count: 999 },
      ...overrides,
    },
    err_msg: '',
    err_no: 0,
    log_id: 'excluded-log-id',
  }
}

test('normalizes a public embed descriptor and excludes raw HTML, identity, metrics, and logs', () => {
  const result = normalizePublicVideoEmbedResponse(payload(), { input, observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.videoEmbed, {
    videoId: input.videoId,
    title: '#中国机器人突破感知极限',
    width: 1080,
    height: 1920,
    playerUrl: 'https://open.douyin.com/player/video?vid=7601036371859459343&autoplay=0',
  })
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('<iframe'), false)
  assert.equal(serialized.includes('excluded-log-id'), false)
  assert.equal(serialized.includes('"uid"'), false)
  assert.equal(serialized.includes('digg_count'), false)
})

test('accepts positive int64 video IDs and rejects aliases or unexpected fields before fetch', async () => {
  normalizePublicVideoEmbedResponse(payload({ iframe_code: '<iframe src="https://open.douyin.com/player/video?vid=1"></iframe>' }), { input: { videoId: '1' } })
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicVideoEmbed({ videoId: '0' }, { fetchImpl }), /positive decimal int64/)
  await assert.rejects(() => readPublicVideoEmbed({ videoId: '9223372036854775808' }, { fetchImpl }), /positive decimal int64/)
  await assert.rejects(() => readPublicVideoEmbed({ videoId: 'latest' }, { fetchImpl }), /positive decimal int64/)
  await assert.rejects(() => readPublicVideoEmbed({ ...input, baseUrl: 'https://example.com' }, { fetchImpl }), /unknown input fields/)
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl, userAgent: 'Googlebot' }), /identify an application/)
  assert.equal(calls, 0)
})

test('rejects platform errors, malformed dimensions, and unsafe or mismatched player URLs', () => {
  assert.throws(() => normalizePublicVideoEmbedResponse({ err_no: 1, err_msg: '非公开视频' }, { input }), (error) => error instanceof DouyinPublicVideoEmbedError && error.code === 'platform-rejected')
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ video_width: 0 }), { input }), /video_width/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ iframe_code: '<iframe src="https://evil.example/player/video?vid=7601036371859459343"></iframe>' }), { input }), /escaped/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ iframe_code: '<iframe src="https://open.douyin.com/player/video?vid=7601036371859459344"></iframe>' }), { input }), /identity/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ iframe_code: '<iframe src="https://open.douyin.com/player/video?vid=7601036371859459343&token=secret"></iframe>' }), { input }), /unreviewed parameter/)
  assert.throws(() => normalizePublicVideoEmbedResponse(payload({ iframe_code: '<iframe src="https://open.douyin.com/player/video?vid=7601036371859459343"></iframe><img src="https://example.com">' }), { input }), /exactly one src/)
})

test('uses one fixed official request without redirects or retry', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url: url.href, options }
    return new Response(JSON.stringify(payload()), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await readPublicVideoEmbed(input, { fetchImpl, now: () => new Date('2026-08-27T00:00:00Z') })
  assert.equal(result.videoEmbed.videoId, input.videoId)
  assert.equal(request.url, `${DOUYIN_OPEN_API_ORIGIN}/api/douyin/v1/video/get_iframe_by_video?video_id=${input.videoId}`)
  assert.equal(request.options.redirect, 'error')
  assert.match(request.options.headers['user-agent'], /https:\/\//)
})

test('enforces JSON and response budgets and surfaces policy failures', async () => {
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }) }), /text\/html/)
  await assert.rejects(() => readPublicVideoEmbed(input, { fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }) }), /64 KiB/)
  let calls = 0
  await assert.rejects(
    () => readPublicVideoEmbed(input, { fetchImpl: async () => { calls += 1; return new Response('{}', { status: 403, headers: { 'content-type': 'application/json' } }) } }),
    (error) => error instanceof DouyinPublicVideoEmbedError && error.code === 'access-policy-blocked',
  )
  assert.equal(calls, 1)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTIONS,
  buildActionRequest,
  executeCandidatePublicSocialSearch,
  normalizeInput,
  OpenConnectorPublicSocialSearchError,
} from '../src/index.mjs'

test('maps one bounded initial-page search to exact audited OpenConnector actions', () => {
  assert.deepEqual(buildActionRequest({ platform: 'xiaohongshu', query: '个人助理 宠物' }), {
    platform: 'xiaohongshu',
    actionId: ACTIONS.xiaohongshu.id,
    actionInput: { keywords: '个人助理 宠物', page: 1 },
    requestDigest: 'aa57802bc38414080a546fc24ee51827567a407ee1f450914f0aaf0d99c4d544',
  })
  assert.deepEqual(buildActionRequest({ platform: 'douyin', query: 'AI 宠物' }).actionInput, { keyword: 'AI 宠物', cursor: 0 })
})

test('rejects pagination, provider action ids, identifiers and broad platform input', () => {
  assert.throws(() => normalizeInput({ platform: 'xiaohongshu', query: 'pet', page: 2 }), /unknown input fields/)
  assert.throws(() => normalizeInput({ platform: 'twitter', query: 'pet' }), /unsupported platform/)
  assert.throws(() => normalizeInput({ platform: 'douyin', query: 'x', actionId: 'github.delete_repository' }), /unknown input fields/)
  assert.throws(() => normalizeInput({ platform: 'xiaohongshu', query: 'pet\nauthor' }), /single-line/)
})

test('calls only a loopback runtime and returns an explicitly unsafe ephemeral handoff', async () => {
  const calls = []
  const result = await executeCandidatePublicSocialSearch({ platform: 'xiaohongshu', query: 'personal assistant pet' }, {
    credentials: { runtimeToken: 'oct_runtime_secret_not_returned' },
    connectionAlias: 'research-one',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ success: true, message: 'OK', data: { results: [{ note_id: 'raw-provider-id', title: 'test' }], rawData: { duplicate: true }, raw: { token: 'must-not-copy' } }, meta: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `http://127.0.0.1:3000/v1/actions/${ACTIONS.xiaohongshu.id}`)
  assert.deepEqual(JSON.parse(calls[0].options.body), { input: { keywords: 'personal assistant pet', page: 1 } })
  assert.equal(calls[0].options.headers['x-oo-connector-alias'], 'research-one')
  assert.equal(calls[0].options.headers['idempotency-key'], undefined)
  assert.equal(result.coverage.safeForOkf, false)
  assert.equal(result.coverage.identityRemoved, false)
  assert.equal(result.coverage.retention, 'ephemeral-internal-only')
  assert.equal(Object.hasOwn(result, 'raw'), false)
  assert.equal(Object.hasOwn(result, 'rawData'), false)
  assert.equal(JSON.stringify(result).includes('must-not-copy'), false)
  assert.equal(JSON.stringify(result).includes('oct_runtime_secret_not_returned'), false)
})

test('refuses non-loopback runtimes, loose credentials, retries and changed response shapes', async () => {
  const input = { platform: 'douyin', query: 'assistant pet' }
  await assert.rejects(() => executeCandidatePublicSocialSearch(input, { runtimeOrigin: 'https://connector.example.com', credentials: { runtimeToken: 'oct_runtime_secret' } }), (error) => error instanceof OpenConnectorPublicSocialSearchError && error.code === 'configuration-error')
  await assert.rejects(() => executeCandidatePublicSocialSearch(input, { credentials: { runtimeToken: 'short' } }), (error) => error.code === 'credential-unavailable')
  let attempts = 0
  await assert.rejects(() => executeCandidatePublicSocialSearch(input, {
    credentials: { runtimeToken: 'oct_runtime_secret' },
    fetchImpl: async () => {
      attempts += 1
      return new Response('{"success":false}', { status: 429, headers: { 'content-type': 'application/json' } })
    },
  }), (error) => error.code === 'rate-limited')
  assert.equal(attempts, 1)
  await assert.rejects(() => executeCandidatePublicSocialSearch(input, {
    credentials: { runtimeToken: 'oct_runtime_secret' },
    fetchImpl: async () => new Response(JSON.stringify({ success: true, message: 'OK', data: { rawData: {} }, meta: {} }), { status: 200, headers: { 'content-type': 'application/json' } }),
  }), (error) => error.code === 'response-shape-changed')
})

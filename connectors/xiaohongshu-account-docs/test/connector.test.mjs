import assert from 'node:assert/strict'
import test from 'node:test'
import { EXPECTED_ENDPOINTS, parseAccountApiReference, readAccountApiSurface } from '../src/index.mjs'

function fixture({ extraPath = '' } = {}) {
  const sections = EXPECTED_ENDPOINTS.map((endpoint, index) => `<h2 id="${endpoint.id}">${index + 1}. ${endpoint.title}</h2><code>${endpoint.path}</code>`).join('')
  return `<html><head><title>API 参考 · 小红书开放平台</title></head><body>
    Base URL：https://openaccount.xiaohongshu.com 测试环境 https://openaccount.beta.xiaohongshu.com
    请求方法：POST（Content-Type: application/json） PKCE
    ${sections}${extraPath}
    device_code 只能保存在应用服务端，禁止下发到车机屏幕、浏览器页面或 WebView；
    二维码只应使用 verification_uri_complete 渲染，禁止包含 device_code。
    按 interval 秒的最小间隔轮询
  </body></html>`
}

test('normalizes the documented official account API surface', () => {
  const result = parseAccountApiReference(fixture(), { observedAt: '2026-08-27T00:00:00.000Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.endpoints.length, 10)
  assert.equal(result.notDocumentedInThisReference.includes('note-publishing'), true)
  assert.equal(result.semanticDigest.length, 64)
})

test('requires review when an unknown OAuth path appears', () => {
  const result = parseAccountApiReference(fixture({ extraPath: '<p>/api/sns/v1/oauth2/new_operation</p>' }))
  assert.equal(result.conformance.status, 'review-required')
  assert.deepEqual(result.conformance.undocumentedPaths, ['/api/sns/v1/oauth2/new_operation'])
})

test('live reader rejects non-HTML responses', async () => {
  const fetchImpl = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  await assert.rejects(() => readAccountApiSurface({ fetchImpl }), /unexpected content type/)
})

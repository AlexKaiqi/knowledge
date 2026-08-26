import assert from 'node:assert/strict'
import test from 'node:test'
import { OFFICIAL_DOCUMENTS, parseDouyinOpenPlatformDocuments, readDouyinOpenPlatformSurface } from '../src/index.mjs'

function fixture(overrides = {}) {
  const text = {
    'openapi-list': '个人资料 获取用户公开信息 内容能力 搜索能力 数据开放服务',
    'content-publishing': '内容发布接入方案 直接发布 视频或图片 查看授权帐号发布的全部视频 查看视频审核状态 删除视频 用户 授权',
    'oauth-overview': 'OAuth2.0 access_token refresh_token open_id',
    'access-token': 'access_token 存储在服务端 client_secret',
    'create-video': 'Scope: video.create 需要申请权限 需要用户授权 每次调用都需要在产品设计中让用户明确感知相关操作',
    ...overrides,
  }
  return OFFICIAL_DOCUMENTS.map((document) => ({ ...document, html: `<main>${text[document.id]}</main>` }))
}

test('normalizes the official Douyin capability surface without claiming callability', () => {
  const result = parseDouyinOpenPlatformDocuments(fixture(), { observedAt: '2026-08-27T00:00:00Z' })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.capabilityFamilies.every((family) => family.documented), true)
  assert.equal(result.accessBoundary.documentationDoesNotProveCallable, true)
})

test('requires review when an official capability family disappears', () => {
  const result = parseDouyinOpenPlatformDocuments(fixture({ 'openapi-list': '个人资料 获取用户公开信息 内容能力 数据开放服务' }))
  assert.equal(result.conformance.status, 'review-required')
})

test('live reader rejects non-HTML documents', async () => {
  const fetchImpl = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  await assert.rejects(() => readDouyinOpenPlatformSurface({ fetchImpl }), /returned application\/json/)
})

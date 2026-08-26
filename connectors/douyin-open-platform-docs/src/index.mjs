import { createHash } from 'node:crypto'

export const OFFICIAL_DOCUMENTS = Object.freeze([
  {
    id: 'openapi-list',
    title: 'OpenAPI 列表',
    url: 'https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/list/',
  },
  {
    id: 'content-publishing',
    title: '抖音内容发布接入方案',
    url: 'https://open.douyin.com/platform/resource/docs/ability/content-management/douyin-publish-solution/',
  },
  {
    id: 'oauth-overview',
    title: '总体授权说明',
    url: 'https://open.douyin.com/platform/resource/docs/develop/permission/overall-permission',
  },
  {
    id: 'access-token',
    title: '获取 access_token',
    url: 'https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/account-permission/get-access-token/',
  },
  {
    id: 'create-video',
    title: '创建视频',
    url: 'https://open.douyin.com/platform/resource/docs/openapi/video-management/douyin/create/create-video',
  },
])

const FAMILY_ASSERTIONS = [
  { id: 'oauth-authorization', documentId: 'oauth-overview', markers: ['OAuth2.0', 'access_token', 'refresh_token', 'open_id'] },
  { id: 'user-public-profile', documentId: 'openapi-list', markers: ['个人资料', '获取用户公开信息'] },
  { id: 'content-capabilities', documentId: 'openapi-list', markers: ['内容能力'] },
  { id: 'search-capabilities', documentId: 'openapi-list', markers: ['搜索能力'] },
  { id: 'data-open-services', documentId: 'openapi-list', markers: ['数据开放服务'] },
  { id: 'content-publishing', documentId: 'content-publishing', markers: ['内容发布接入方案', '直接发布', '视频或图片'] },
  { id: 'authorized-content-management', documentId: 'content-publishing', markers: ['查看授权帐号发布的全部视频', '查看视频审核状态', '删除视频'] },
]

function textContent(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }

export function parseDouyinOpenPlatformDocuments(documents, { observedAt = new Date().toISOString() } = {}) {
  const indexed = new Map(documents.map((document) => [document.id, { ...document, text: textContent(document.html ?? '') }]))
  const documentChecks = OFFICIAL_DOCUMENTS.map((expected) => {
    const observed = indexed.get(expected.id)
    return { id: `document-${expected.id}`, passed: Boolean(observed?.text) && observed.url.startsWith('https://') }
  })
  const families = FAMILY_ASSERTIONS.map((family) => ({
    id: family.id,
    documented: family.markers.every((marker) => indexed.get(family.documentId)?.text.includes(marker)),
  }))
  const securityRequirements = [
    { id: 'server-side-token-storage', documented: ['access_token', '存储在服务端'].every((marker) => indexed.get('access-token')?.text.includes(marker)) },
    { id: 'user-awareness-for-delegated-publish', documented: ['需要用户授权', '每次调用', '用户明确感知'].every((marker) => indexed.get('create-video')?.text.includes(marker)) },
  ]
  const assertions = [
    ...documentChecks,
    { id: 'capability-families', passed: families.every((family) => family.documented) },
    { id: 'security-requirements', passed: securityRequirements.every((requirement) => requirement.documented) },
  ]
  const projection = {
    source: { id: 'douyin-open-platform-docs', documents: OFFICIAL_DOCUMENTS },
    capabilityFamilies: families,
    securityRequirements,
    accessBoundary: {
      approvedApplicationRequired: true,
      scopesMayRequireApplication: true,
      userAuthorizationMayBeRequired: true,
      documentationDoesNotProveCallable: true,
    },
  }
  return {
    ...projection,
    observedAt,
    semanticDigest: digest(projection),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readDouyinOpenPlatformSurface({ fetchImpl = fetch, timeoutMs = 20_000, now = () => new Date() } = {}) {
  const documents = await Promise.all(OFFICIAL_DOCUMENTS.map(async (document) => {
    const response = await fetchImpl(document.url, { method: 'GET', headers: { accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`Douyin official document ${document.id} failed: HTTP_${response.status}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('text/html')) throw new Error(`Douyin official document ${document.id} returned ${contentType || 'no content type'}`)
    return { ...document, url: response.url || document.url, html: await response.text() }
  }))
  return parseDouyinOpenPlatformDocuments(documents, { observedAt: now().toISOString() })
}

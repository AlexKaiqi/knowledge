import { createHash } from 'node:crypto'

export const SOURCE_URL = 'https://openaccount.xiaohongshu.com/docs/api-reference'
export const PRODUCTION_BASE_URL = 'https://openaccount.xiaohongshu.com'
export const TEST_BASE_URL = 'https://openaccount.beta.xiaohongshu.com'

export const EXPECTED_ENDPOINTS = Object.freeze([
  { id: 'auth-info', title: '查询授权状态 / 拉起授权页', path: '/api/sns/v1/oauth2/auth_info' },
  { id: 'authorize', title: '用户授权并获取 code', path: '/api/sns/v1/oauth2/authorize' },
  { id: 'access-token', title: '换取 access_token', path: '/api/sns/v1/oauth2/access_token' },
  { id: 'refresh-token', title: '刷新 access_token', path: '/api/sns/v1/oauth2/refresh_token' },
  { id: 'token-status', title: '校验 access_token 有效性', path: '/api/sns/v1/oauth2/token_status' },
  { id: 'user-info', title: '获取用户基本信息', path: '/api/sns/v1/oauth2/batch_get_min_user_info' },
  { id: 'auth-app-list', title: '用户已授权应用列表', path: '/api/sns/v1/oauth2/auth_app/list' },
  { id: 'auth-app-remove', title: '用户解除授权', path: '/api/sns/v1/oauth2/auth_app/remove' },
  { id: 'device-code', title: '创建设备授权', path: '/api/sns/v1/oauth2/device/code' },
  { id: 'device-token', title: '轮询设备 Token', path: '/api/sns/v1/oauth2/device/token' },
])

function decodeHtml(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function textContent(value) {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function unique(values) {
  return [...new Set(values)]
}

function parseEndpointSections(html) {
  const headings = [...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)]
  const endpoints = []
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const id = heading[1].match(/\bid=(?:"([^"]+)"|'([^']+)')/i)?.slice(1).find(Boolean)
    if (!id) continue
    const sectionEnd = headings[index + 1]?.index ?? html.length
    const section = html.slice(heading.index, sectionEnd)
    const path = section.match(/\/api\/sns\/v1\/oauth2\/[a-z0-9_/]+/i)?.[0]
    if (!path) continue
    const title = textContent(heading[2]).replace(/^\d+\.\s*/, '')
    endpoints.push({ order: endpoints.length + 1, id, title, path })
  }
  return endpoints
}

function digestProjection(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function parseAccountApiReference(html, { sourceUrl = SOURCE_URL, observedAt = new Date().toISOString() } = {}) {
  if (typeof html !== 'string' || html.length === 0) throw new Error('official API reference HTML is empty')
  const text = textContent(html)
  const compactText = text.replace(/\s+/g, '')
  const title = textContent(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const endpoints = parseEndpointSections(html)
  const paths = unique([...html.matchAll(/\/api\/sns\/v1\/oauth2\/[a-z0-9_/]+/gi)].map((match) => match[0]))
  const undocumentedPaths = paths.filter((path) => !endpoints.some((endpoint) => endpoint.path === path))
  const missingExpectedPaths = EXPECTED_ENDPOINTS
    .filter((expected) => !endpoints.some((endpoint) => endpoint.path === expected.path && endpoint.id === expected.id))
    .map((endpoint) => endpoint.path)
  const assertions = [
    { id: 'official-title', passed: title.includes('API 参考') && title.includes('小红书开放平台') },
    { id: 'production-base-url', passed: text.includes(PRODUCTION_BASE_URL) },
    { id: 'test-base-url', passed: text.includes(TEST_BASE_URL) },
    { id: 'post-json-transport', passed: /请求方法[：:]POST/.test(compactText) && text.includes('application/json') },
    { id: 'expected-endpoint-catalog', passed: missingExpectedPaths.length === 0 && endpoints.length === EXPECTED_ENDPOINTS.length },
    { id: 'pkce-documented', passed: text.includes('PKCE') },
    { id: 'device-code-server-only', passed: compactText.includes('device_code只能保存在应用服务端') && compactText.includes('禁止下发到车机屏幕、浏览器页面或WebView') },
    { id: 'safe-qr-payload', passed: compactText.includes('二维码只应使用verification_uri_complete渲染') && compactText.includes('禁止包含device_code') },
    { id: 'polling-interval', passed: compactText.includes('按interval秒的最小间隔轮询') },
  ]
  const projection = {
    source: { id: 'xiaohongshu-account-api-reference', url: sourceUrl, title },
    transport: {
      method: 'POST',
      contentType: 'application/json',
      productionBaseUrl: PRODUCTION_BASE_URL,
      testBaseUrl: TEST_BASE_URL,
    },
    endpoints,
    documentedOperationFamilies: ['oauth-authorization', 'token-lifecycle', 'minimum-user-profile', 'authorized-app-management', 'device-authorization'],
    notDocumentedInThisReference: ['note-publishing', 'owned-note-listing', 'note-feedback'],
    safetyRequirements: [
      'Keep device_code on the application server; never send it to a screen, browser page, or WebView.',
      'Render device authorization QR codes from verification_uri_complete only; never include device_code.',
      'Poll the device token endpoint no faster than the returned interval.',
    ],
  }
  return {
    ...projection,
    observedAt,
    semanticDigest: digestProjection(projection),
    conformance: {
      status: assertions.every((assertion) => assertion.passed) && undocumentedPaths.length === 0 ? 'passed' : 'review-required',
      assertions,
      missingExpectedPaths,
      undocumentedPaths,
    },
  }
}

export async function readAccountApiSurface({ fetchImpl = fetch, timeoutMs = 15_000, now = () => new Date() } = {}) {
  const response = await fetchImpl(SOURCE_URL, {
    method: 'GET',
    headers: { accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`official API reference request failed: HTTP_${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('text/html')) throw new Error(`official API reference returned unexpected content type: ${contentType || 'missing'}`)
  return parseAccountApiReference(await response.text(), { sourceUrl: response.url || SOURCE_URL, observedAt: now().toISOString() })
}

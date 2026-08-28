import { createHash } from 'node:crypto'

export const TIKTOK_ORIGIN = 'https://www.tiktok.com'
export const OEMBED_ENDPOINT = `${TIKTOK_ORIGIN}/oembed`
export const ENDPOINT_TEMPLATE = `${OEMBED_ENDPOINT}?url={videoUrl}`
export const MAX_RESPONSE_BYTES = 128 * 1024

const ALLOWED_INPUT_KEYS = new Set(['videoUrl'])
const VIDEO_PATH_PATTERN = /^\/@([A-Za-z0-9._-]{2,24})\/video\/([1-9]\d{0,19})$/
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/
const digest = (value) => createHash('sha256').update(value).digest('hex')

export class TikTokPublicVideoEmbedError extends Error {
  constructor(message, { code, httpStatus = null } = {}) {
    super(message)
    this.name = 'TikTokPublicVideoEmbedError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

function parseVideoUrl(value) {
  if (typeof value !== 'string' || value.length > 256) throw new Error('videoUrl must be a canonical TikTok public video URL')
  let url
  try { url = new URL(value) } catch { throw new Error('videoUrl must be a canonical TikTok public video URL') }
  if (url.origin !== TIKTOK_ORIGIN || url.username || url.password || url.search || url.hash) throw new Error('videoUrl must be a canonical TikTok public video URL')
  const match = url.pathname.match(VIDEO_PATH_PATTERN)
  if (!match) throw new Error('videoUrl must match https://www.tiktok.com/@handle/video/{videoId}')
  return { videoUrl: `${TIKTOK_ORIGIN}${url.pathname}`, handle: match[1], videoId: match[2] }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  return parseVideoUrl(input.videoUrl)
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function boundedText(value, field, maxLength) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`TikTok ${field} shape changed`)
  return value
}

function positiveDimension(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 32768) throw new Error(`TikTok ${field} shape changed`)
  return value
}

function assertPayload(payload, request) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('TikTok oEmbed response envelope changed')
  if (payload.version !== '1.0' || payload.type !== 'video' || payload.provider_name !== 'TikTok' || payload.provider_url !== TIKTOK_ORIGIN) {
    throw new Error('TikTok oEmbed provider contract changed')
  }
  if (payload.width !== '100%' || payload.height !== '100%') throw new Error('TikTok oEmbed responsive dimensions changed')
  const author = parseVideoUrl(`${boundedText(payload.author_url, 'author_url', 256)}/video/${request.videoId}`)
  if (author.handle !== request.handle) throw new Error('TikTok oEmbed author identity does not match the requested URL')
  const html = boundedText(payload.html, 'html', 65536)
  if (!html.includes(`data-video-id="${request.videoId}"`) || !html.includes(`cite="${request.videoUrl}"`)) throw new Error('TikTok oEmbed HTML identity changed')
  return {
    title: boundedText(payload.title, 'title', 2200),
    thumbnailWidth: positiveDimension(payload.thumbnail_width, 'thumbnail_width'),
    thumbnailHeight: positiveDimension(payload.thumbnail_height, 'thumbnail_height'),
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`TikTok oEmbed read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('TikTok oEmbed response exceeds the 128 KiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('TikTok oEmbed response has no body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('TikTok oEmbed response exceeds the 128 KiB budget')
    }
    source += decoder.decode(value, { stream: true })
  }
  source += decoder.decode()
  try { return JSON.parse(source) } catch { throw new Error('TikTok oEmbed response is not valid JSON') }
}

export function normalizePublicVideoEmbedResponse(payload, { input, observedAt = new Date().toISOString() } = {}) {
  const requestWithIdentity = assertInput(input)
  const descriptor = assertPayload(payload, requestWithIdentity)
  const request = { videoUrl: requestWithIdentity.videoUrl }
  const projection = {
    source: { id: 'tiktok-public-video-embed', apiOrigin: TIKTOK_ORIGIN, endpointTemplate: ENDPOINT_TEMPLATE, accessClass: 'official-public-no-account' },
    request,
    videoEmbed: { videoId: requestWithIdentity.videoId, canonicalUrl: request.videoUrl, ...descriptor },
  }
  const serialized = JSON.stringify(projection)
  const assertions = [
    { id: 'exact-video-identity', passed: projection.videoEmbed.canonicalUrl === request.videoUrl },
    { id: 'bounded-public-fields', passed: projection.videoEmbed.title.length <= 2200 && projection.videoEmbed.thumbnailWidth <= 32768 && projection.videoEmbed.thumbnailHeight <= 32768 },
    { id: 'unsafe-upstream-fields-excluded', passed: !/(?:author|html|thumbnailUrl|cookie|token|metrics|comments|raw)/i.test(serialized) },
  ]
  return { ...projection, observedAt, resultDigest: digest(JSON.stringify(projection)), conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } }
}

export async function readPublicVideoEmbed(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
} = {}) {
  const request = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const url = new URL('/oembed', TIKTOK_ORIGIN)
  url.searchParams.set('url', request.videoUrl)
  const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', 'user-agent': assertUserAgent(userAgent) }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new TikTokPublicVideoEmbedError(`TikTok oEmbed read failed: HTTP_${response.status}`, { code: response.status === 404 ? 'platform-rejected' : response.status === 429 ? 'rate-limited' : response.status === 403 ? 'access-policy-blocked' : `http-${response.status}`, httpStatus: response.status })
  return normalizePublicVideoEmbedResponse(await readJsonResponse(response), { input: { videoUrl: request.videoUrl }, observedAt: now().toISOString() })
}

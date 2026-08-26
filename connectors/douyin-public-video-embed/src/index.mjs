import { createHash } from 'node:crypto'

export const DOUYIN_OPEN_API_ORIGIN = 'https://open.douyin.com'
export const ENDPOINT_TEMPLATE = `${DOUYIN_OPEN_API_ORIGIN}/api/douyin/v1/video/get_iframe_by_video?video_id={videoId}`
export const MAX_RESPONSE_BYTES = 64 * 1024

const ALLOWED_INPUT_KEYS = new Set(['videoId'])
const VIDEO_ID_PATTERN = /^[1-9]\d{0,18}$/
const MAX_SIGNED_INT64 = 9223372036854775807n
const CONTACTABLE_USER_AGENT_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+ \((?:https:\/\/[^()\s]+|[^()\s@]+@[^()\s@]+)\)$/

const digest = (value) => createHash('sha256').update(value).digest('hex')

export class DouyinPublicVideoEmbedError extends Error {
  constructor(message, { code, httpStatus = null, platformError = null } = {}) {
    super(message)
    this.name = 'DouyinPublicVideoEmbedError'
    this.code = code
    this.httpStatus = httpStatus
    this.platformError = platformError
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.videoId !== 'string' || !VIDEO_ID_PATTERN.test(input.videoId) || BigInt(input.videoId) > MAX_SIGNED_INT64) {
    throw new Error('videoId must be a positive decimal int64 string')
  }
  return { videoId: input.videoId }
}

function assertUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length > 128 || !CONTACTABLE_USER_AGENT_PATTERN.test(userAgent) || /[\r\n]/.test(userAgent)) {
    throw new Error('userAgent must identify an application/version and include one HTTPS contact URL or email address')
  }
  return userAgent
}

function boundedText(value, field, maxLength) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`Douyin ${field} shape changed`)
  }
  return value
}

function positiveDimension(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 32768) throw new Error(`Douyin ${field} shape changed`)
  return value
}

function safePlayerUrl(iframeCode, videoId) {
  const html = boundedText(iframeCode, 'iframe_code', 4096)
  const matches = [...html.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)]
  if (matches.length !== 1) throw new Error('Douyin iframe_code must contain exactly one src')
  let url
  try { url = new URL(matches[0][2]) } catch { throw new Error('Douyin iframe player URL is invalid') }
  if (url.origin !== DOUYIN_OPEN_API_ORIGIN || url.pathname !== '/player/video' || url.username || url.password || url.hash) {
    throw new Error('Douyin iframe player URL escaped the official player origin')
  }
  if (url.searchParams.get('vid') !== videoId) throw new Error('Douyin iframe player identity changed')
  const allowedKeys = new Set(['vid', 'autoplay'])
  if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) throw new Error('Douyin iframe player URL contains an unreviewed parameter')
  const autoplay = url.searchParams.get('autoplay')
  if (autoplay !== null && !['0', '1'].includes(autoplay)) throw new Error('Douyin iframe autoplay shape changed')
  const normalized = new URL('/player/video', DOUYIN_OPEN_API_ORIGIN)
  normalized.searchParams.set('vid', videoId)
  normalized.searchParams.set('autoplay', '0')
  return normalized.href
}

function assertPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Number.isInteger(payload.err_no) || typeof payload.err_msg !== 'string') {
    throw new Error('Douyin public video embed response envelope changed')
  }
  if (payload.err_no !== 0) {
    throw new DouyinPublicVideoEmbedError(`Douyin public video embed API rejected the video: ${payload.err_no}`, {
      code: 'platform-rejected',
      platformError: payload.err_no,
    })
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('Douyin public video embed data is missing')
  return payload.data
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error(`Douyin public video embed read returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new Error('Douyin public video embed response exceeds the 64 KiB budget')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Douyin public video embed response has no body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('Douyin public video embed response exceeds the 64 KiB budget')
    }
    source += decoder.decode(value, { stream: true })
  }
  source += decoder.decode()
  try { return JSON.parse(source) } catch { throw new Error('Douyin public video embed response is not valid JSON') }
}

export function normalizePublicVideoEmbedResponse(payload, { input, observedAt = new Date().toISOString() } = {}) {
  const request = assertInput(input)
  const data = assertPayload(payload)
  const projection = {
    source: {
      id: 'douyin-public-video-embed',
      apiOrigin: DOUYIN_OPEN_API_ORIGIN,
      endpointTemplate: ENDPOINT_TEMPLATE,
      accessClass: 'official-public-no-permission',
    },
    request,
    videoEmbed: {
      videoId: request.videoId,
      title: boundedText(data.video_title, 'video_title', 2000),
      width: positiveDimension(data.video_width, 'video_width'),
      height: positiveDimension(data.video_height, 'video_height'),
      playerUrl: safePlayerUrl(data.iframe_code, request.videoId),
    },
  }
  const assertions = [
    { id: 'exact-video-identity', passed: projection.videoEmbed.playerUrl.includes(`vid=${request.videoId}`) },
    { id: 'official-player-origin', passed: new URL(projection.videoEmbed.playerUrl).origin === DOUYIN_OPEN_API_ORIGIN },
    { id: 'bounded-public-fields', passed: projection.videoEmbed.title.length <= 2000 && projection.videoEmbed.width <= 32768 && projection.videoEmbed.height <= 32768 },
    { id: 'unsafe-embed-html-excluded', passed: !Object.hasOwn(projection.videoEmbed, 'iframeHtml') && !Object.hasOwn(projection.videoEmbed, 'iframeCode') },
    { id: 'identity-and-metrics-excluded', passed: !['author', 'authorId', 'metrics', 'comments', 'mediaUrl', 'raw'].some((field) => Object.hasOwn(projection.videoEmbed, field)) },
  ]
  return {
    ...projection,
    observedAt,
    resultDigest: digest(JSON.stringify(projection)),
    conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions },
  }
}

export async function readPublicVideoEmbed(input, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  now = () => new Date(),
} = {}) {
  const request = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  const normalizedUserAgent = assertUserAgent(userAgent)
  const url = new URL('/api/douyin/v1/video/get_iframe_by_video', DOUYIN_OPEN_API_ORIGIN)
  url.searchParams.set('video_id', request.videoId)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': normalizedUserAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new DouyinPublicVideoEmbedError(`Douyin public video embed read failed: HTTP_${response.status}`, {
      code: response.status === 429 ? 'rate-limited' : response.status === 403 ? 'access-policy-blocked' : `http-${response.status}`,
      httpStatus: response.status,
    })
  }
  return normalizePublicVideoEmbedResponse(await readJsonResponse(response), { input: request, observedAt: now().toISOString() })
}

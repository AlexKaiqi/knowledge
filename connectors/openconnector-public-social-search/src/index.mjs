import { createHash } from 'node:crypto'

export const OPENCONNECTOR_RELEASE = Object.freeze({
  tag: 'v1.4.0',
  commit: '96fb6afe8c244c7d6f3a8351df06d7b04137f6a6',
})

export const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000'
export const ACTIONS = Object.freeze({
  xiaohongshu: Object.freeze({ id: 'tikhub.search_xiaohongshu_notes', inputKey: 'keywords', initialCursor: Object.freeze({ page: 1 }) }),
  douyin: Object.freeze({ id: 'tikhub.search_douyin_videos', inputKey: 'keyword', initialCursor: Object.freeze({ cursor: 0 }) }),
})

const ALLOWED_INPUT_KEYS = new Set(['platform', 'query'])
const ALLOWED_RUNTIME_ORIGINS = new Set(['http://127.0.0.1:3000', 'http://localhost:3000'])

export class OpenConnectorPublicSocialSearchError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'OpenConnectorPublicSocialSearchError'
    this.code = code
    this.details = details
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex')

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new OpenConnectorPublicSocialSearchError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new OpenConnectorPublicSocialSearchError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (!Object.hasOwn(ACTIONS, input.platform)) throw new OpenConnectorPublicSocialSearchError('invalid-input', `unsupported platform: ${input.platform}`)
  if (typeof input.query !== 'string' || input.query.trim().length < 2 || input.query.trim().length > 120 || /[\r\n\0]/.test(input.query)) {
    throw new OpenConnectorPublicSocialSearchError('invalid-input', 'query must be a single-line string between 2 and 120 characters')
  }
  return { platform: input.platform, query: input.query.trim() }
}

function normalizeRuntimeOrigin(value = DEFAULT_RUNTIME_ORIGIN) {
  let origin
  try { origin = new URL(value).origin } catch { throw new OpenConnectorPublicSocialSearchError('configuration-error', 'runtimeOrigin is invalid') }
  if (origin !== value || !ALLOWED_RUNTIME_ORIGINS.has(origin)) {
    throw new OpenConnectorPublicSocialSearchError('configuration-error', 'runtimeOrigin must be the fixed loopback OpenConnector origin')
  }
  return origin
}

function normalizeAlias(value = 'dsh-public-research') {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value) || value.length > 64) {
    throw new OpenConnectorPublicSocialSearchError('configuration-error', 'connectionAlias must be a lowercase opaque alias up to 64 characters')
  }
  return value
}

function normalizeRuntimeToken(credentials) {
  const token = credentials?.runtimeToken
  if (typeof token !== 'string' || token.length < 16 || token.length > 4096 || /[\s\0]/.test(token)) {
    throw new OpenConnectorPublicSocialSearchError('credential-unavailable', 'OpenConnector runtime token is unavailable')
  }
  return token
}

export function buildActionRequest(input) {
  const normalized = normalizeInput(input)
  const route = ACTIONS[normalized.platform]
  const actionInput = { [route.inputKey]: normalized.query, ...route.initialCursor }
  return {
    platform: normalized.platform,
    actionId: route.id,
    actionInput,
    requestDigest: digest(stableJson({ actionId: route.id, actionInput })),
  }
}

async function readJsonWithLimit(response, maximum) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximum) throw new OpenConnectorPublicSocialSearchError('response-too-large', `OpenConnector response exceeds ${maximum} bytes`)
  if (!response.body) throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'OpenConnector response has no body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let source = ''
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maximum) {
        await reader.cancel()
        throw new OpenConnectorPublicSocialSearchError('response-too-large', `OpenConnector response exceeds ${maximum} bytes`)
      }
      source += decoder.decode(value, { stream: true })
    }
    source += decoder.decode()
  } catch (error) {
    if (error instanceof OpenConnectorPublicSocialSearchError) throw error
    throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'OpenConnector response is not valid UTF-8')
  }
  try { return JSON.parse(source) } catch { throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'OpenConnector response is not valid JSON') }
}

function normalizeEnvelope(envelope, request) {
  const valid = envelope && envelope.success === true && envelope.message === 'OK'
    && envelope.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
    && envelope.meta && typeof envelope.meta === 'object' && !Array.isArray(envelope.meta)
  if (!valid) throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'OpenConnector success envelope changed shape')
  if (!Object.hasOwn(envelope.data, 'results')) throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'TikHub search output no longer contains results')
  const upstreamPayload = envelope.data.results
  if (upstreamPayload === undefined) throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'TikHub results are undefined')
  const payloadDigest = digest(stableJson(upstreamPayload))
  return {
    schemaVersion: 'dsh.openconnector-public-social-search-candidate/v1',
    platform: request.platform,
    actionId: request.actionId,
    upstreamRelease: OPENCONNECTOR_RELEASE,
    coverage: {
      representation: 'single-initial-page-unprojected',
      paginationFollowed: false,
      identityRemoved: false,
      safeForOkf: false,
      retention: 'ephemeral-internal-only',
    },
    requestDigest: request.requestDigest,
    payloadDigest,
    upstreamPayload,
  }
}

export async function executeCandidatePublicSocialSearch(input, {
  fetchImpl = fetch,
  credentials,
  runtimeOrigin = DEFAULT_RUNTIME_ORIGIN,
  connectionAlias = 'dsh-public-research',
  timeoutMs = 15_000,
  maxResponseBytes = 1_048_576,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new OpenConnectorPublicSocialSearchError('configuration-error', 'timeoutMs must be between 1000 and 30000')
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 65_536 || maxResponseBytes > 2_097_152) throw new OpenConnectorPublicSocialSearchError('configuration-error', 'maxResponseBytes must be between 65536 and 2097152')
  const request = buildActionRequest(input)
  const origin = normalizeRuntimeOrigin(runtimeOrigin)
  const alias = normalizeAlias(connectionAlias)
  const token = normalizeRuntimeToken(credentials)
  const response = await fetchImpl(`${origin}/v1/actions/${request.actionId}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-oo-connector-alias': alias,
    },
    body: JSON.stringify({ input: request.actionInput }),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 401 ? 'authentication-failed'
      : response.status === 403 ? 'connection-or-action-not-allowed'
        : response.status === 404 ? 'action-unavailable'
          : response.status === 429 ? 'rate-limited'
            : 'upstream-failed'
    throw new OpenConnectorPublicSocialSearchError(code, `OpenConnector action failed: HTTP_${response.status}`, { status: response.status })
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) throw new OpenConnectorPublicSocialSearchError('response-shape-changed', 'OpenConnector response is not JSON')
  return normalizeEnvelope(await readJsonWithLimit(response, maxResponseBytes), request)
}

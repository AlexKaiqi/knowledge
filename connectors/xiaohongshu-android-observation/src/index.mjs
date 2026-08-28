import { createHash } from 'node:crypto'
import { SaxesParser } from 'saxes'

export const XIAOHONGSHU_ANDROID_PACKAGE = 'com.xingin.xhs'
export const SEARCH_CAPABILITY_REF = '/capabilities/research/search-public-social-content.md'
export const REVIEWED_UPSTREAMS = Object.freeze({
  portal: Object.freeze({ commit: 'd4cb7d6657385488239812e776df584f890e32fd', license: 'AGPL-3.0-or-later' }),
  appiumMcp: Object.freeze({ commit: '3ae19c07e63e4bc2ca7763bb7ed2ba6815bd9286', license: 'Apache-2.0' }),
})

const ALLOWED_INPUT_KEYS = new Set(['platform', 'query', 'limit'])
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const MAX_NODE_COUNT = 4_000
const MAX_TREE_DEPTH = 80
const MAX_VISIBLE_TEXTS = 200

export class XiaohongshuAndroidObservationError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'XiaohongshuAndroidObservationError'
    this.code = code
    this.details = details
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function boundedText(value, maximum = 500) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').normalize('NFC').trim().slice(0, maximum)
}

function boolean(value) {
  return value === true || value === 'true'
}

function parseBounds(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const values = ['left', 'top', 'right', 'bottom'].map((key) => Number(value[key]))
    if (values.every(Number.isFinite)) return { left: values[0], top: values[1], right: values[2], bottom: values[3] }
  }
  if (typeof value !== 'string') return null
  const numbers = value.match(/-?\d+/g)?.map(Number)
  if (!numbers || numbers.length !== 4 || !numbers.every(Number.isFinite)) return null
  return { left: numbers[0], top: numbers[1], right: numbers[2], bottom: numbers[3] }
}

function center(bounds) {
  if (!bounds || bounds.right <= bounds.left || bounds.bottom <= bounds.top) throw new XiaohongshuAndroidObservationError('unusable-ui-tree', 'target element has no usable bounds')
  return { x: Math.round((bounds.left + bounds.right) / 2), y: Math.round((bounds.top + bounds.bottom) / 2) }
}

function normalizeOrigin(value, defaultValue) {
  let url
  try { url = new URL(value ?? defaultValue) } catch { throw new XiaohongshuAndroidObservationError('configuration-error', 'runtimeOrigin is invalid') }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new XiaohongshuAndroidObservationError('configuration-error', 'runtimeOrigin must be an exact loopback HTTP origin')
  }
  return url.origin
}

function normalizeToken(credentials) {
  const token = credentials?.portalToken
  if (typeof token !== 'string' || token.length < 16 || token.length > 4096 || /[\s\0]/.test(token)) {
    throw new XiaohongshuAndroidObservationError('credential-unavailable', 'Portal local token is unavailable')
  }
  return token
}

function normalizeSessionId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new XiaohongshuAndroidObservationError('configuration-error', 'Appium session ID must be opaque and bounded')
  }
  return value
}

export function normalizeSearchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new XiaohongshuAndroidObservationError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new XiaohongshuAndroidObservationError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (input.platform !== 'xiaohongshu') throw new XiaohongshuAndroidObservationError('invalid-input', 'platform must be xiaohongshu')
  if (typeof input.query !== 'string') throw new XiaohongshuAndroidObservationError('invalid-input', 'query must be text')
  const query = input.query.replace(/\s+/g, ' ').normalize('NFC').trim()
  if (query.length < 1 || query.length > 80 || /[\r\n\0]/.test(input.query)) throw new XiaohongshuAndroidObservationError('invalid-input', 'query must be a bounded single-line phrase')
  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new XiaohongshuAndroidObservationError('invalid-input', 'limit must be between 1 and 20')
  return { platform: 'xiaohongshu', query, limit }
}

function portalNode(raw) {
  return {
    text: boundedText(raw?.text),
    description: boundedText(raw?.contentDescription ?? raw?.['content-desc']),
    hint: boundedText(raw?.hint),
    resourceId: boundedText(raw?.resourceId ?? raw?.['resource-id'], 300),
    className: boundedText(raw?.className ?? raw?.class, 300),
    packageName: boundedText(raw?.packageName ?? raw?.package, 300),
    bounds: parseBounds(raw?.boundsInScreen ?? raw?.bounds),
    clickable: boolean(raw?.isClickable ?? raw?.clickable),
    editable: boolean(raw?.isEditable ?? raw?.editable) || /EditText/i.test(String(raw?.className ?? raw?.class ?? '')),
    enabled: raw?.isEnabled === undefined && raw?.enabled === undefined ? true : boolean(raw?.isEnabled ?? raw?.enabled),
  }
}

function flattenTree(roots) {
  const nodes = []
  const visit = (raw, depth) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    if (depth > MAX_TREE_DEPTH || nodes.length >= MAX_NODE_COUNT) throw new XiaohongshuAndroidObservationError('response-too-large', 'UI tree exceeds the bounded traversal budget')
    nodes.push(portalNode(raw))
    const children = Array.isArray(raw.children) ? raw.children : []
    for (const child of children) visit(child, depth + 1)
  }
  for (const root of Array.isArray(roots) ? roots : [roots]) visit(root, 0)
  return nodes
}

function parseNestedJson(value, field) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { throw new XiaohongshuAndroidObservationError('response-shape-changed', `${field} is not valid nested JSON`) }
}

export function normalizePortalStateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'Portal response must be an object')
  if (envelope.status !== 'success') throw new XiaohongshuAndroidObservationError('upstream-failed', boundedText(envelope.error, 300) || 'Portal returned an error')
  const result = parseNestedJson(envelope.result, 'Portal result')
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'Portal state result must be an object')
  const tree = parseNestedJson(result.a11y_tree, 'Portal a11y_tree')
  const phone = parseNestedJson(result.phone_state, 'Portal phone_state')
  if (!Array.isArray(tree) || !phone || typeof phone !== 'object' || Array.isArray(phone)) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'Portal state lacks a11y_tree or phone_state')
  const nodes = flattenTree(tree)
  return {
    source: 'android-accessibility',
    packageName: boundedText(phone.packageName, 300),
    activityName: boundedText(phone.activityName, 300),
    keyboardVisible: boolean(phone.keyboardVisible),
    nodes,
  }
}

export function normalizeAppiumPageSource(source) {
  if (typeof source !== 'string' || source.length < 1) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'Appium page source is empty')
  if (Buffer.byteLength(source) > 4_194_304) throw new XiaohongshuAndroidObservationError('response-too-large', 'Appium page source exceeds the hard limit')
  const nodes = []
  let parseError
  const parser = new SaxesParser({ xmlns: false })
  parser.on('opentag', (tag) => {
    if (nodes.length >= MAX_NODE_COUNT) throw new XiaohongshuAndroidObservationError('response-too-large', 'Appium UI tree exceeds the node budget')
    const attributes = Object.fromEntries(Object.entries(tag.attributes).map(([key, item]) => [key, typeof item === 'string' ? item : item.value]))
    nodes.push(portalNode({
      text: attributes.text,
      contentDescription: attributes['content-desc'] ?? attributes.label ?? attributes.name,
      resourceId: attributes['resource-id'],
      className: attributes.class ?? tag.name,
      packageName: attributes.package,
      bounds: attributes.bounds,
      clickable: attributes.clickable,
      editable: attributes.editable,
      enabled: attributes.enabled,
    }))
  })
  parser.on('error', (error) => { parseError = error })
  try { parser.write(source).close() } catch (error) { parseError = error }
  if (parseError) throw new XiaohongshuAndroidObservationError('response-shape-changed', `Appium page source is invalid XML: ${parseError.message}`)
  if (nodes.length < 1) throw new XiaohongshuAndroidObservationError('unusable-ui-tree', 'Appium page source contains no nodes')
  const packages = nodes.map((node) => node.packageName).filter(Boolean)
  return {
    source: 'appium-uiautomator2-xml',
    packageName: packages.find((value) => value === XIAOHONGSHU_ANDROID_PACKAGE) ?? packages[0] ?? '',
    activityName: '',
    keyboardVisible: nodes.some((node) => node.editable),
    nodes,
  }
}

async function readJsonWithLimit(response, maximum) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new XiaohongshuAndroidObservationError('response-too-large', `response exceeds ${maximum} bytes`)
  if (!response.body) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximum) {
      await reader.cancel()
      throw new XiaohongshuAndroidObservationError('response-too-large', `response exceeds ${maximum} bytes`)
    }
    chunks.push(value)
  }
  let payload
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) } catch { throw new XiaohongshuAndroidObservationError('response-shape-changed', 'response is not valid JSON') }
  return payload
}

function formBody(values) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) params.set(key, String(value))
  return params.toString()
}

export class PortalHttpDriver {
  constructor({ runtimeOrigin = 'http://127.0.0.1:8080', credentials, fetchImpl = fetch, timeoutMs = 10_000, maxResponseBytes = 2_097_152 } = {}) {
    this.origin = normalizeOrigin(runtimeOrigin, 'http://127.0.0.1:8080')
    this.token = normalizeToken(credentials)
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.maxResponseBytes = maxResponseBytes
  }

  async request(path, { method = 'GET', form } = {}) {
    const response = await this.fetchImpl(`${this.origin}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(form ? { body: formBody(form) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) throw new XiaohongshuAndroidObservationError(response.status === 401 ? 'authentication-failed' : 'upstream-failed', `Portal request failed: HTTP_${response.status}`)
    if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('json')) throw new XiaohongshuAndroidObservationError('response-shape-changed', 'Portal response is not JSON')
    return readJsonWithLimit(response, this.maxResponseBytes)
  }

  async snapshot() {
    return normalizePortalStateEnvelope(await this.request('/state'))
  }

  async action(path, form) {
    const envelope = await this.request(path, { method: 'POST', form })
    if (envelope?.status !== 'success') throw new XiaohongshuAndroidObservationError('device-action-failed', boundedText(envelope?.error, 300) || `Portal action ${path} failed`)
  }

  async activateApp(packageName) { await this.action('/app', { package: packageName, stopBeforeLaunch: false }) }
  async tap(point) { await this.action('/tap', point) }
  async inputText(text) { await this.action('/keyboard/input', { base64_text: Buffer.from(text, 'utf8').toString('base64'), clear: true }) }
  async pressEnter() { await this.action('/keyboard/key', { key_code: 66 }) }
}

function appiumValue(envelope, field) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !Object.hasOwn(envelope, 'value')) throw new XiaohongshuAndroidObservationError('response-shape-changed', `Appium ${field} response lacks value`)
  return envelope.value
}

export class AppiumW3cDriver {
  constructor({ runtimeOrigin = 'http://127.0.0.1:4723', appiumSessionId, fetchImpl = fetch, timeoutMs = 10_000, maxResponseBytes = 2_097_152 } = {}) {
    this.origin = normalizeOrigin(runtimeOrigin, 'http://127.0.0.1:4723')
    this.sessionId = normalizeSessionId(appiumSessionId)
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.maxResponseBytes = maxResponseBytes
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await this.fetchImpl(`${this.origin}/session/${encodeURIComponent(this.sessionId)}${path}`, {
      method,
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) throw new XiaohongshuAndroidObservationError('upstream-failed', `Appium request failed: HTTP_${response.status}`)
    const envelope = await readJsonWithLimit(response, this.maxResponseBytes)
    if (envelope?.value?.error) throw new XiaohongshuAndroidObservationError('device-action-failed', boundedText(envelope.value.message, 500) || envelope.value.error)
    return envelope
  }

  async snapshot() {
    const source = appiumValue(await this.request('/source'), 'source')
    return normalizeAppiumPageSource(source)
  }

  async activateApp(packageName) {
    await this.request('/appium/device/activate_app', { method: 'POST', body: { appId: packageName } })
  }

  async tap({ x, y }) {
    await this.request('/actions', {
      method: 'POST',
      body: { actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'touch' }, actions: [
        { type: 'pointerMove', duration: 0, x, y, origin: 'viewport' },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 50 },
        { type: 'pointerUp', button: 0 },
      ] }] },
    })
  }

  async inputText(text) {
    const active = appiumValue(await this.request('/element/active'), 'active element')
    const elementId = active?.['element-6066-11e4-a52e-4f735466cecf'] ?? active?.ELEMENT
    if (typeof elementId !== 'string' || elementId.length < 1) throw new XiaohongshuAndroidObservationError('device-action-failed', 'Appium returned no active editable element')
    await this.request(`/element/${encodeURIComponent(elementId)}/value`, { method: 'POST', body: { text, value: [...text] } })
  }

  async pressEnter() {
    await this.request('/actions', { method: 'POST', body: { actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: '\uE007' },
      { type: 'keyUp', value: '\uE007' },
    ] }] } })
  }
}

export function createAndroidDriver(config = {}, credentials, dependencies = {}) {
  if (config.routeId === 'portal-http') return new PortalHttpDriver({ ...config, credentials, ...dependencies })
  if (config.routeId === 'appium-w3c') return new AppiumW3cDriver({ ...config, ...dependencies })
  throw new XiaohongshuAndroidObservationError('configuration-error', `unsupported route: ${config.routeId}`)
}

function nodeLabel(node) {
  return node.text || node.description || node.hint
}

function findSearchControl(snapshot) {
  const candidates = snapshot.nodes.filter((node) => {
    const label = nodeLabel(node)
    return label === '搜索' || /(?:^|[/:_.-])search(?:$|[/:_.-])/i.test(node.resourceId) || /搜索/.test(node.description)
  })
  return candidates.find((node) => node.clickable && node.enabled && node.bounds)
    ?? candidates.find((node) => node.enabled && node.bounds)
    ?? null
}

function findSearchInput(snapshot) {
  return snapshot.nodes.find((node) => node.editable && node.enabled && node.bounds && /search|搜索/i.test(`${node.resourceId} ${node.hint} ${node.description}`))
    ?? snapshot.nodes.find((node) => node.editable && node.enabled && node.bounds)
    ?? null
}

function assertXiaohongshu(snapshot, phase) {
  if (snapshot.packageName !== XIAOHONGSHU_ANDROID_PACKAGE) {
    throw new XiaohongshuAndroidObservationError('unexpected-foreground-app', `${phase} foreground package is not Xiaohongshu`, { observedPackage: snapshot.packageName || 'unknown' })
  }
}

function projectVisibleTexts(snapshot, query, limit) {
  const excluded = new Set(['搜索', '首页', '购物', '消息', '我', query])
  const unique = []
  const seen = new Set()
  for (const node of snapshot.nodes) {
    const value = nodeLabel(node)
    if (!value || value.length < 2 || excluded.has(value) || seen.has(value)) continue
    seen.add(value)
    unique.push(value)
    if (unique.length >= Math.min(MAX_VISIBLE_TEXTS, Math.max(limit * 8, limit))) break
  }
  return unique
}

export async function executeCandidateXiaohongshuAndroidSearch(input, {
  config,
  credentials,
  driver,
  fetchImpl,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => new Date(),
} = {}) {
  const query = normalizeSearchInput(input)
  const settleMs = config?.settleMs ?? 1_000
  if (!Number.isInteger(settleMs) || settleMs < 100 || settleMs > 10_000) throw new XiaohongshuAndroidObservationError('configuration-error', 'settleMs must be between 100 and 10000')
  const runtime = driver ?? createAndroidDriver(config, credentials, { fetchImpl })
  await runtime.activateApp(XIAOHONGSHU_ANDROID_PACKAGE)
  await sleep(settleMs)
  const landing = await runtime.snapshot()
  assertXiaohongshu(landing, 'landing')
  const searchControl = findSearchControl(landing)
  if (!searchControl) throw new XiaohongshuAndroidObservationError('recipe-drift', 'Xiaohongshu search control was not found in the structured tree')
  await runtime.tap(center(searchControl.bounds))
  await sleep(settleMs)
  const search = await runtime.snapshot()
  assertXiaohongshu(search, 'search')
  const inputNode = findSearchInput(search)
  if (!inputNode) throw new XiaohongshuAndroidObservationError('recipe-drift', 'Xiaohongshu search input was not found in the structured tree')
  await runtime.tap(center(inputNode.bounds))
  await runtime.inputText(query.query)
  await runtime.pressEnter()
  await sleep(settleMs)
  const results = await runtime.snapshot()
  assertXiaohongshu(results, 'results')
  const visibleTexts = projectVisibleTexts(results, query.query, query.limit)
  const projection = {
    schemaVersion: 'dsh.xiaohongshu-android-search-candidate/v1',
    platform: 'xiaohongshu',
    query: query.query,
    observedAt: now().toISOString(),
    coverage: {
      representation: 'single-visible-android-result-surface',
      structuredNodeCount: results.nodes.length,
      visibleTextCount: visibleTexts.length,
      requestedLimit: query.limit,
      resultCardsProven: false,
      commentsLoaded: false,
      paginationFollowed: false,
      screenshotsUsed: false,
      visionUsed: false,
      safeForOkf: false,
      retention: 'ephemeral-internal-only',
    },
    visibleTexts,
  }
  return { ...projection, observationDigest: sha256(stableJson(projection)) }
}

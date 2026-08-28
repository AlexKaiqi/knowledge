import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  AppiumW3cDriver,
  executeCandidateXiaohongshuAndroidSearch,
  normalizeAppiumPageSource,
  normalizePortalStateEnvelope,
  PortalHttpDriver,
  XIAOHONGSHU_ANDROID_PACKAGE,
} from '../src/index.mjs'

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

function portalEnvelope(tree, phone = {}) {
  return {
    status: 'success',
    result: JSON.stringify({
      a11y_tree: tree,
      phone_state: { packageName: XIAOHONGSHU_ANDROID_PACKAGE, activityName: '.IndexActivityV2', keyboardVisible: false, ...phone },
    }),
  }
}

test('candidate definition and config conform to repository schemas', async () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  addFormats(ajv)
  for (const [schemaPath, instancePath] of [
    ['../../../spec/connector-definition.schema.json', '../connector.json'],
  ]) {
    const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url)))
    const instance = JSON.parse(await readFile(new URL(instancePath, import.meta.url)))
    const validate = ajv.compile(schema)
    assert.equal(validate(instance), true, JSON.stringify(validate.errors))
  }
  const configSchema = JSON.parse(await readFile(new URL('../config.schema.json', import.meta.url)))
  const validateConfig = ajv.compile(configSchema)
  assert.equal(validateConfig({ routeId: 'portal-http', runtimeOrigin: 'http://127.0.0.1:8080' }), true)
  assert.equal(validateConfig({ routeId: 'appium-w3c', runtimeOrigin: 'http://127.0.0.1:4723' }), false)
})

test('normalizes Portal nested state without retaining overlay indices or raw selectors in the result surface', () => {
  const snapshot = normalizePortalStateEnvelope(portalEnvelope([
    { index: 1, resourceId: 'com.xingin.xhs:id/search', className: 'android.widget.TextView', text: '搜索', bounds: '0, 20, 100, 80', children: [
      { index: 2, resourceId: '', className: 'android.widget.TextView', text: '拼豆入门', bounds: '0, 100, 400, 160', children: [] },
    ] },
  ]))
  assert.equal(snapshot.packageName, XIAOHONGSHU_ANDROID_PACKAGE)
  assert.equal(snapshot.nodes.length, 2)
  assert.deepEqual(snapshot.nodes[0].bounds, { left: 0, top: 20, right: 100, bottom: 80 })
  assert.equal(Object.hasOwn(snapshot.nodes[0], 'index'), false)
})

test('normalizes Appium UiAutomator2 XML into the same private node shape', () => {
  const snapshot = normalizeAppiumPageSource(`<?xml version="1.0" encoding="UTF-8"?><hierarchy><android.widget.FrameLayout package="${XIAOHONGSHU_ANDROID_PACKAGE}" bounds="[0,0][1080,2400]"><android.widget.EditText package="${XIAOHONGSHU_ANDROID_PACKAGE}" resource-id="com.xingin.xhs:id/search" text="拼豆" clickable="true" enabled="true" bounds="[20,80][1000,180]" /></android.widget.FrameLayout></hierarchy>`)
  assert.equal(snapshot.source, 'appium-uiautomator2-xml')
  assert.equal(snapshot.packageName, XIAOHONGSHU_ANDROID_PACKAGE)
  assert.equal(snapshot.nodes.length, 3)
  assert.equal(snapshot.nodes[2].editable, true)
})

test('Portal client is loopback-only, authenticated, bounded and uses only documented search actions', async () => {
  assert.throws(() => new PortalHttpDriver({ runtimeOrigin: 'http://192.168.1.5:8080', credentials: { portalToken: 'portal_token_123456' } }), /loopback/)
  const calls = []
  const responses = [
    jsonResponse(portalEnvelope([])),
    jsonResponse({ status: 'success', result: 'ok' }),
    jsonResponse({ status: 'success', result: 'ok' }),
  ]
  const driver = new PortalHttpDriver({
    credentials: { portalToken: 'portal_token_123456' },
    fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift() },
  })
  await driver.snapshot()
  await driver.inputText('拼豆')
  await driver.pressEnter()
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/state', '/keyboard/input', '/keyboard/key'])
  assert.ok(calls.every((call) => call.options.headers.authorization === 'Bearer portal_token_123456'))
  assert.equal(new URLSearchParams(calls[1].options.body).get('base64_text'), Buffer.from('拼豆').toString('base64'))
  assert.equal(new URLSearchParams(calls[2].options.body).get('key_code'), '66')
})

test('Appium client reads page source and emits bounded W3C actions without exposing the session to callers', async () => {
  const calls = []
  const source = `<hierarchy><node package="${XIAOHONGSHU_ANDROID_PACKAGE}" text="搜索" clickable="true" enabled="true" bounds="[0,0][100,100]" /></hierarchy>`
  const driver = new AppiumW3cDriver({
    appiumSessionId: 'opaque-session-1',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/source')) return jsonResponse({ value: source })
      return jsonResponse({ value: null })
    },
  })
  const snapshot = await driver.snapshot()
  await driver.tap({ x: 50, y: 50 })
  assert.equal(snapshot.packageName, XIAOHONGSHU_ANDROID_PACKAGE)
  assert.ok(calls[0].url.includes('/session/opaque-session-1/source'))
  assert.equal(JSON.parse(calls[1].options.body).actions[0].parameters.pointerType, 'touch')
})

test('executes one structured-tree search and returns an explicitly non-OKF candidate projection', async () => {
  const calls = []
  const snapshots = [
    { packageName: XIAOHONGSHU_ANDROID_PACKAGE, nodes: [{ text: '搜索', resourceId: 'search', clickable: true, enabled: true, bounds: { left: 0, top: 0, right: 100, bottom: 100 } }] },
    { packageName: XIAOHONGSHU_ANDROID_PACKAGE, nodes: [] },
  ]
  snapshots[1] = { packageName: XIAOHONGSHU_ANDROID_PACKAGE, nodes: [{ text: '', description: '搜索', hint: '搜索', resourceId: 'search_input', className: 'android.widget.EditText', editable: true, enabled: true, bounds: { left: 10, top: 10, right: 200, bottom: 80 } }] }
  snapshots.push({ packageName: XIAOHONGSHU_ANDROID_PACKAGE, nodes: [
    { text: '拼豆', description: '', hint: '', resourceId: '', enabled: true },
    { text: '拼豆入门：材料怎么选', description: '', hint: '', resourceId: '', enabled: true },
    { text: '新手总是烫坏怎么办', description: '', hint: '', resourceId: '', enabled: true },
  ] })
  const driver = {
    activateApp: async (value) => calls.push(['activate', value]),
    snapshot: async () => snapshots.shift(),
    tap: async (value) => calls.push(['tap', value]),
    inputText: async (value) => calls.push(['input', value]),
    pressEnter: async () => calls.push(['enter']),
  }
  const result = await executeCandidateXiaohongshuAndroidSearch({ platform: 'xiaohongshu', query: '拼豆', limit: 10 }, {
    driver,
    config: { settleMs: 100 },
    sleep: async () => {},
    now: () => new Date('2026-08-27T08:00:00Z'),
  })
  assert.deepEqual(calls.map((call) => call[0]), ['activate', 'tap', 'tap', 'input', 'enter'])
  assert.deepEqual(result.visibleTexts, ['拼豆入门：材料怎么选', '新手总是烫坏怎么办'])
  assert.equal(result.coverage.screenshotsUsed, false)
  assert.equal(result.coverage.visionUsed, false)
  assert.equal(result.coverage.resultCardsProven, false)
  assert.equal(result.coverage.safeForOkf, false)
  assert.equal(JSON.stringify(result).includes('search_input'), false)
})

test('fails closed on foreground-package drift instead of tapping another app', async () => {
  let taps = 0
  const driver = {
    activateApp: async () => {},
    snapshot: async () => ({ packageName: 'com.example.other', nodes: [] }),
    tap: async () => { taps += 1 },
  }
  await assert.rejects(() => executeCandidateXiaohongshuAndroidSearch({ platform: 'xiaohongshu', query: '拼豆' }, {
    driver, config: { settleMs: 100 }, sleep: async () => {},
  }), (error) => error.code === 'unexpected-foreground-app')
  assert.equal(taps, 0)
})

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  computeRevisionDigest,
  XiaohongshuBrowserConnector,
  xiaohongshuBrowserInternals,
  XiaohongshuSkillCliDriver,
} from '../src/index.mjs'

function response(data, { status = 200 } = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function revision() {
  return {
    id: 'revision-001',
    title: '闭环探针 0826',
    body: '仅用于私密闭环验证。marker:xhs-probe-0826',
    verificationMarker: 'marker:xhs-probe-0826',
    topics: ['测试'],
    media: [{ kind: 'image', path: '/tmp/xhs-probe.png', sha256: 'a'.repeat(64) }],
  }
}

function confirmation(value) {
  return {
    capabilityId: 'xiaohongshu.note.publish-private-and-observe',
    revisionId: value.id,
    revisionDigest: computeRevisionDigest(value),
    expiresAt: '2030-01-01T00:00:00.000Z',
  }
}

function skillCliRuntime({ publishStatus = 'confirmed' } = {}) {
  const calls = []
  const reviewedDiff = 'reviewed-test-diff\n'
  let meCalls = 0
  const oldFeed = { id: 'old', xsecToken: 'old-token', noteCard: { displayTitle: 'old' } }
  const newFeed = { id: 'new-note', xsecToken: 'ephemeral-skill-token', noteCard: { displayTitle: '闭环探针 0826' } }
  const execFileImpl = async (file, args, options) => {
    calls.push({ file, args, options })
    if (file === 'git' && args[0] === 'rev-parse') return { stdout: 'afa96802d3e61cdd5e7bd7b37ec59182bbe07d37\n', stderr: '' }
    if (file === 'git' && args[0] === 'status') return { stdout: ' M scripts/__main__.py\n', stderr: '' }
    if (file === 'git' && args[0] === 'diff') return { stdout: reviewedDiff, stderr: '' }
    if (args.includes('--version')) return { stdout: 'Python 3.12.11\n', stderr: '' }
    if (args.includes('--help')) return { stdout: 'usage: publish --visibility {公开可见,仅自己可见,仅互关好友可见}\n', stderr: '' }
    if (args.includes('check-login') || args.includes('check-creator-login')) return { stdout: '{"is_logged_in":true}', stderr: '' }
    if (args.includes('me')) {
      meCalls += 1
      return { stdout: JSON.stringify({ feeds: meCalls === 1 ? [oldFeed] : [newFeed, oldFeed] }), stderr: '' }
    }
    if (args.includes('publish')) {
      return { stdout: JSON.stringify({ status: publishStatus, published: publishStatus === 'confirmed', visibility: '仅自己可见' }), stderr: '' }
    }
    if (args.includes('feed')) {
      const withComments = args.includes('--load-comments')
      return {
        stdout: JSON.stringify({
          note: {
            desc: '仅用于私密闭环验证。marker:xhs-probe-0826',
            imageList: [{}],
            interactInfo: { likedCount: '2', collectedCount: '1', commentCount: withComments ? '1' : '0', sharedCount: '0' },
          },
          comments: { list: withComments ? [{ id: 'comment-skill', content: 'skill route', userInfo: { nickname: 'must-not-leak' } }] : [] },
        }),
        stderr: '',
      }
    }
    throw new Error(`unexpected CLI call: ${args.join(' ')}`)
  }
  return { calls, execFileImpl, runtimeDiffSha256: createHash('sha256').update(reviewedDiff).digest('hex') }
}

test('connector only permits an authenticated loopback sidecar', () => {
  assert.throws(() => new XiaohongshuBrowserConnector({ baseUrl: 'https://example.com', token: 'secret' }), /loopback-only/)
  assert.throws(() => new XiaohongshuBrowserConnector(), /token credential/)
})

test('skill upstream manifest, adapter constants, and reviewed patch stay synchronized', async () => {
  const manifest = JSON.parse(await readFile(new URL('../skill-upstream.json', import.meta.url), 'utf8'))
  const patch = await readFile(new URL(`../../../${manifest.patch.path}`, import.meta.url))
  assert.equal(createHash('sha256').update(patch).digest('hex'), manifest.patch.sha256)
  assert.equal(manifest.commit, xiaohongshuBrowserInternals.XIAOHONGSHU_SKILL_REVISION)
  assert.equal(manifest.patch.runtimeDiffSha256, xiaohongshuBrowserInternals.XIAOHONGSHU_SKILL_RUNTIME_DIFF_SHA256)
  assert.equal(manifest.pythonVersion, '3.12')
})

test('skill route requires a pinned runtime, opaque profile, and reviewed visibility CLI', async () => {
  assert.throws(() => new XiaohongshuSkillCliDriver({ runtimeRoot: 'relative', profile: 'probe-a' }), /absolute path/)
  assert.throws(() => new XiaohongshuSkillCliDriver({ runtimeRoot: '/tmp/runtime', profile: '../escape' }), /opaque profile/)
  const driver = new XiaohongshuSkillCliDriver({
    runtimeRoot: '/tmp/runtime',
    profile: 'probe-a',
    expectedRuntimeDiffSha256: createHash('sha256').update('reviewed-test-diff\n').digest('hex'),
    execFileImpl: async (file, args) => {
      if (file !== 'git' && args.includes('--version')) return { stdout: 'Python 3.12.11\n', stderr: '' }
      if (file !== 'git') return { stdout: 'usage: publish\n', stderr: '' }
      if (args[0] === 'rev-parse') return { stdout: 'afa96802d3e61cdd5e7bd7b37ec59182bbe07d37\n', stderr: '' }
      if (args[0] === 'status') return { stdout: ' M scripts/__main__.py\n', stderr: '' }
      return { stdout: 'reviewed-test-diff\n', stderr: '' }
    },
  })
  await assert.rejects(() => driver.ensureRuntime(), /lacks the reviewed private-visibility CLI patch/)
})

test('skill authorization is explicit, visible, profile-bound, and minimized', async () => {
  const runtime = skillCliRuntime()
  const execFileImpl = async (file, args, options) => {
    if (file === 'git' || args.includes('--help') || args.includes('--version')) return runtime.execFileImpl(file, args, options)
    runtime.calls.push({ file, args, options })
    if (args.includes('creator-login')) return { stdout: '{"status":"logged_in","username":"must-not-leak"}', stderr: '' }
    if (args.includes('login')) return { stdout: '{"status":"logged_in","username":"must-not-leak"}', stderr: '' }
    throw new Error(`unexpected CLI call: ${args.join(' ')}`)
  }
  const headless = new XiaohongshuSkillCliDriver({
    runtimeRoot: '/tmp/runtime', profile: 'probe-a', execFileImpl, expectedRuntimeDiffSha256: runtime.runtimeDiffSha256,
  })
  await assert.rejects(() => headless.authorize(), /visible browser/)
  const driver = new XiaohongshuSkillCliDriver({
    runtimeRoot: '/tmp/runtime', profile: 'probe-a', headless: false, execFileImpl, expectedRuntimeDiffSha256: runtime.runtimeDiffSha256,
  })
  const result = await driver.authorize()
  assert.deepEqual(result, { readReady: true, writeReady: true, phase: 'complete', status: 'logged_in' })
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
  const loginCalls = runtime.calls.filter((call) => call.args.includes('login') || call.args.includes('creator-login'))
  assert.equal(loginCalls.length, 2)
  assert.ok(loginCalls.every((call) => call.args[call.args.indexOf('--headless') + 1] === 'false'))
  assert.ok(loginCalls.every((call) => call.args[call.args.indexOf('--profile') + 1] === 'probe-a'))
})

test('skill route executes the private write through argv and reconciles it through the owned profile', async (t) => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-xhs-skill-test-'))
  t.after(() => rm(stateRoot, { recursive: true, force: true }))
  const runtime = skillCliRuntime()
  const connector = new XiaohongshuBrowserConnector({
    routeId: 'creator-web-xiaohongshu-skill',
    skillRuntimeRoot: '/tmp/xhs-skill-runtime',
    profile: 'owned-probe-a',
    stateRoot,
    skillExecFileImpl: runtime.execFileImpl,
    skillExpectedRuntimeDiffSha256: runtime.runtimeDiffSha256,
    now: () => new Date('2026-08-26T08:00:00.000Z'),
  })
  const frozen = revision()
  const result = await connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) })
  assert.equal(result.status, 'confirmed')
  assert.equal(result.platformObject.id, 'new-note')
  assert.equal(result.observation.status, 'available')
  assert.equal(JSON.stringify(result).includes('ephemeral-skill-token'), false)
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
  const publishCall = runtime.calls.find((call) => call.args.includes('publish') && !call.args.includes('--help'))
  assert.ok(publishCall)
  assert.equal(publishCall.args[publishCall.args.indexOf('--visibility') + 1], '仅自己可见')
  assert.equal(publishCall.args.includes('--auto-publish'), true)
  assert.equal(publishCall.args[publishCall.args.indexOf('--profile') + 1], 'owned-probe-a')
  assert.equal(runtime.calls.filter((call) => call.file === 'git').length, 3)
})

test('skill route preserves submitted_unconfirmed as a durable no-retry outcome', async (t) => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-xhs-skill-unknown-'))
  t.after(() => rm(stateRoot, { recursive: true, force: true }))
  const runtime = skillCliRuntime({ publishStatus: 'submitted_unconfirmed' })
  const connector = new XiaohongshuBrowserConnector({
    routeId: 'creator-web-xiaohongshu-skill',
    skillRuntimeRoot: '/tmp/xhs-skill-runtime',
    profile: 'owned-probe-a',
    stateRoot,
    skillExecFileImpl: runtime.execFileImpl,
    skillExpectedRuntimeDiffSha256: runtime.runtimeDiffSha256,
    now: () => new Date('2026-08-26T08:00:00.000Z'),
  })
  const frozen = revision()
  await assert.rejects(() => connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) }), /outcome is unknown/)
  const publishCalls = () => runtime.calls.filter((call) => call.args.includes('publish') && !call.args.includes('--help')).length
  assert.equal(publishCalls(), 1)
  await assert.rejects(() => connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) }), /requires reconciliation/)
  assert.equal(publishCalls(), 1)
})

test('lists only stable owned-note summaries without leaking ephemeral access artifacts', async () => {
  const feed = {
    id: 'owned-note-1',
    xsecToken: 'must-not-leak',
    noteCard: { displayTitle: '我的笔记', user: { nickname: 'must-not-leak-either' } },
  }
  const queue = [
    response({ status: 'healthy' }),
    response({ success: true, data: { is_logged_in: true } }),
    response({ success: true, data: { feeds: [feed] } }),
  ]
  const connector = new XiaohongshuBrowserConnector({
    token: 'loopback-secret',
    fetchImpl: async () => queue.shift(),
    now: () => new Date('2026-08-27T00:00:00.000Z'),
  })
  const result = await connector.listOwnedNotes({ limit: 1 })
  assert.deepEqual(result, {
    status: 'available',
    observedAt: '2026-08-27T00:00:00.000Z',
    items: [{ externalId: 'owned-note-1', title: '我的笔记', url: 'https://www.xiaohongshu.com/explore/owned-note-1' }],
  })
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
})

test('owned-note listing validates limits before touching the platform', async () => {
  let called = false
  const connector = new XiaohongshuBrowserConnector({ token: 'secret', fetchImpl: async () => { called = true } })
  await assert.rejects(() => connector.listOwnedNotes({ limit: 0 }), /limit must be/)
  assert.equal(called, false)
})

test('private publication is confirmed by owned-profile diff and detail, then observed without identities', async (t) => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-xhs-test-'))
  t.after(() => rm(stateRoot, { recursive: true, force: true }))
  const calls = []
  const oldFeed = { id: 'old', xsecToken: 'old-token', noteCard: { displayTitle: 'old' } }
  const newFeed = { id: 'new-note', xsecToken: 'ephemeral-xsec-token', noteCard: { displayTitle: '闭环探针 0826' } }
  const queue = [
    response({ status: 'healthy' }),
    response({ success: true, data: { is_logged_in: true } }),
    response({ success: true, data: { feeds: [oldFeed] } }),
    response({ success: true, data: { status: '发布完成' } }),
    response({ success: true, data: { feeds: [newFeed, oldFeed] } }),
    response({ success: true, data: { note: { desc: '仅用于私密闭环验证。marker:xhs-probe-0826', imageList: [{}] } } }),
    response({ success: true, data: { feeds: [newFeed, oldFeed] } }),
    response({
      success: true,
      data: {
        note: { interactInfo: { likedCount: '1.2万', collectedCount: '8', commentCount: '1', sharedCount: '0' } },
        comments: { list: [{ id: 'comment-1', content: '测试评论', userInfo: { nickname: 'must-not-leak' }, createTime: 1_700_000_000 }] },
      },
    }),
  ]
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    const next = queue.shift()
    assert.ok(next, `unexpected request: ${url}`)
    return next
  }
  const connector = new XiaohongshuBrowserConnector({
    token: 'loopback-secret',
    stateRoot,
    fetchImpl,
    now: () => new Date('2026-08-26T08:00:00.000Z'),
  })
  const frozen = revision()
  const result = await connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) })

  assert.equal(result.status, 'confirmed')
  assert.equal(result.platformObject.id, 'new-note')
  assert.equal(result.observation.status, 'available')
  assert.equal(result.observation.metrics.find((metric) => metric.name === 'likedCount').value, 12_000)
  assert.deepEqual(result.observation.feedback, [{
    externalId: 'comment-1',
    kind: 'comment',
    body: '测试评论',
    observedAt: '2023-11-14T22:13:20.000Z',
  }])
  assert.equal(JSON.stringify(result).includes('ephemeral-xsec-token'), false)
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
  assert.ok(calls.every((call) => call.options.headers.authorization === 'Bearer loopback-secret'))
  const publish = calls.find((call) => call.url.endsWith('/api/v1/publish'))
  assert.equal(JSON.parse(publish.options.body).visibility, '仅自己可见')

  const repeated = await connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) })
  assert.deepEqual(repeated, result)
  assert.equal(queue.length, 0)
})

test('a digest mismatch is rejected before any platform call', async (t) => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-xhs-test-'))
  t.after(() => rm(stateRoot, { recursive: true, force: true }))
  let called = false
  const frozen = revision()
  const connector = new XiaohongshuBrowserConnector({
    token: 'secret',
    stateRoot,
    fetchImpl: async () => { called = true; throw new Error('must not run') },
    now: () => new Date('2026-08-26T08:00:00.000Z'),
  })
  await assert.rejects(
    connector.publishPrivateNoteAndObserve({
      revision: frozen,
      confirmation: { ...confirmation(frozen), revisionDigest: '0'.repeat(64) },
    }),
    /digest does not match/,
  )
  assert.equal(called, false)
})

test('an ambiguous submit is durably blocked from automatic retry', async (t) => {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-xhs-test-'))
  t.after(() => rm(stateRoot, { recursive: true, force: true }))
  const frozen = revision()
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) return response({ status: 'healthy' })
    if (calls === 2) return response({ success: true, data: { is_logged_in: true } })
    if (calls === 3) return response({ success: true, data: { feeds: [] } })
    throw new Error('network timeout after click')
  }
  const connector = new XiaohongshuBrowserConnector({
    token: 'secret',
    stateRoot,
    fetchImpl,
    now: () => new Date('2026-08-26T08:00:00.000Z'),
  })
  await assert.rejects(
    connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) }),
    /outcome is unknown/,
  )
  const callsAfterUnknown = calls
  await assert.rejects(
    connector.publishPrivateNoteAndObserve({ revision: frozen, confirmation: confirmation(frozen) }),
    /requires reconciliation/,
  )
  assert.equal(calls, callsAfterUnknown)
})

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  computeRevisionDigest,
  XiaohongshuBrowserConnector,
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

test('connector only permits an authenticated loopback sidecar', () => {
  assert.throws(() => new XiaohongshuBrowserConnector({ baseUrl: 'https://example.com', token: 'secret' }), /loopback-only/)
  assert.throws(() => new XiaohongshuBrowserConnector(), /token credential/)
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

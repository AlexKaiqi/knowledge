import assert from 'node:assert/strict'
import test from 'node:test'
import { DouyinPublicVideoEmbedError } from '../../../connectors/douyin-public-video-embed/src/index.mjs'
import { collectDouyinPublicVideoEmbedMaintenance } from '../src/index.mjs'

const stableResult = {
  videoEmbed: {
    videoId: '7601036371859459343',
    title: '#中国机器人突破感知极限',
    width: 1080,
    height: 1920,
    playerUrl: 'https://open.douyin.com/player/video?vid=7601036371859459343&autoplay=0',
  },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when descriptor and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectDouyinPublicVideoEmbedMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when public descriptor changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, videoEmbed: { ...stableResult.videoEmbed, title: 'changed' } }
  const result = await collectDouyinPublicVideoEmbedMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'review-douyin-public-video-embed-change')
})

test('requests a new probe when verification expires', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-08-26T00:00:00Z' } }
  const result = await collectDouyinPublicVideoEmbedMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.proposals.some((proposal) => proposal.action === 'rerun-live-probe'), true)
})

test('separates fixture removal, policy blocks, and connector failures without retrying', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  for (const [code, expectedStatus] of [['platform-rejected', 'review-required'], ['rate-limited', 'deferred'], ['access-policy-blocked', 'deferred']]) {
    let calls = 0
    const result = await collectDouyinPublicVideoEmbedMaintenance({
      reader: async () => { calls += 1; throw new DouyinPublicVideoEmbedError(code, { code }) },
      acceptedState,
    })
    assert.equal(result.status, expectedStatus)
    assert.equal(calls, 1)
  }
  const failed = await collectDouyinPublicVideoEmbedMaintenance({ reader: async () => { throw new Error('shape drift') }, acceptedState })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals[0].action, 'restore-douyin-public-video-embed-access')
})

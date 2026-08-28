import assert from 'node:assert/strict'
import test from 'node:test'
import { TikTokPublicVideoEmbedError } from '../../../connectors/tiktok-public-video-embed/src/index.mjs'
import { collectTikTokPublicVideoEmbedMaintenance } from '../src/index.mjs'

const stable = { videoEmbed: { videoId: '6718335390845095173', canonicalUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', title: 'fixture', thumbnailWidth: 576, thumbnailHeight: 1024 }, conformance: { status: 'passed', assertions: [] } }
test('stays current only while descriptor and report remain current', async () => {
  const result = await collectTikTokPublicVideoEmbedMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stable, acceptedState: { snapshot: stable, report: { expiresAt: '2026-09-03T00:00:00Z' } } })
  assert.equal(result.status, 'current')
})
test('proposes review on descriptor drift or expiry', async () => {
  const changed = { ...stable, videoEmbed: { ...stable.videoEmbed, title: 'changed' } }
  const result = await collectTikTokPublicVideoEmbedMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => changed, acceptedState: { snapshot: stable, report: { expiresAt: '2026-08-26T00:00:00Z' } } })
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals.map((item) => item.action), ['review-tiktok-public-video-embed-change', 'rerun-live-probe'])
})
test('separates fixture removal, policy deferral, and connector failure', async () => {
  for (const [code, status] of [['platform-rejected', 'review-required'], ['rate-limited', 'deferred'], ['access-policy-blocked', 'deferred']]) {
    const result = await collectTikTokPublicVideoEmbedMaintenance({ reader: async () => { throw new TikTokPublicVideoEmbedError(code, { code }) }, acceptedState: { snapshot: stable, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
    assert.equal(result.status, status)
  }
  const failed = await collectTikTokPublicVideoEmbedMaintenance({ reader: async () => { throw new Error('shape drift') }, acceptedState: { snapshot: stable, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(failed.status, 'unreachable')
})

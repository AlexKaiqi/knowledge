import assert from 'node:assert/strict'
import test from 'node:test'
import { WebFeedReaderError } from '../../../connectors/web-feed-reader/src/index.mjs'
import { collectWebFeedReaderMaintenance, FIXTURE_INPUT } from '../src/index.mjs'

const sourceWatchList = { sources: [{ id: 'rss', observation: { assertions: [] } }] }
const projectCatalog = { projects: [{ id: 'source', repository: 'https://github.com/example/source.git', branch: 'main', observedRevision: 'a'.repeat(40), watch: { lastReviewedAt: '2026-08-20T00:00:00Z', reviewCadenceDays: 30 } }] }
const current = { request: FIXTURE_INPUT, feed: { feedDigest: '1'.repeat(64), documentSha256: '2'.repeat(64) }, conformance: { status: 'passed', assertions: [] } }
const acceptedState = { snapshot: current, report: { expiresAt: '2026-09-03T00:00:00Z' } }
const now = () => new Date('2026-08-27T00:00:00Z')
const sourceCheck = async () => ({ id: 'rss', status: 'current', assertions: [] })
const projectHead = async () => 'a'.repeat(40)

test('stays current when feed semantics, standards, upstreams and verification are current', async () => {
  const result = await collectWebFeedReaderMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('separates feed semantic drift from serialization-only and upstream drift', async () => {
  const semantic = await collectWebFeedReaderMaintenance({ now, reader: async () => ({ ...current, feed: { ...current.feed, feedDigest: '3'.repeat(64) } }), sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(semantic.proposals.at(-1).action, 'review-nodejs-release-feed-change')
  const serialized = await collectWebFeedReaderMaintenance({ now, reader: async () => ({ ...current, feed: { ...current.feed, documentSha256: '4'.repeat(64) } }), sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(serialized.status, 'current')
  assert.deepEqual(serialized.proposals, [])
  assert.deepEqual(serialized.feedChange, { classification: 'document-only', documentChanged: true, action: 'observe-without-proposal' })
  const upstream = await collectWebFeedReaderMaintenance({ now, reader: async () => current, sourceCheck: async () => ({ id: 'rss', status: 'review-required' }), projectHead: async () => 'b'.repeat(40), acceptedState, sourceWatchList, projectCatalog })
  assert.deepEqual(upstream.proposals.map((proposal) => proposal.action), ['review-feed-standard-semantic-change', 'review-feed-upstream-change'])
})

test('requests scheduled review and fresh verification without mutating baselines', async () => {
  const staleCatalog = { projects: [{ ...projectCatalog.projects[0], watch: { lastReviewedAt: '2026-08-01T00:00:00Z', reviewCadenceDays: 7 } }] }
  const result = await collectWebFeedReaderMaintenance({ now, reader: async () => current, sourceCheck, projectHead, acceptedState: { ...acceptedState, report: { expiresAt: '2026-08-26T23:59:59Z' } }, sourceWatchList, projectCatalog: staleCatalog })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), ['scheduled-feed-upstream-review', 'rerun-live-probe'])
})

test('distinguishes rate limits, removal, and implementation failure without retrying', async () => {
  for (const [error, status, action] of [
    [new WebFeedReaderError('rate', { code: 'rate-limited', retryAt: '2026-08-27T00:01:00Z' }), 'deferred', 'rerun-after-rate-limit'],
    [new WebFeedReaderError('missing', { code: 'feed-not-found' }), 'review-required', 'review-or-retire-nodejs-release-feed'],
  ]) {
    let calls = 0
    const result = await collectWebFeedReaderMaintenance({ now, reader: async () => { calls += 1; throw error }, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
    assert.equal(result.status, status)
    assert.equal(result.proposals.at(-1).action, action)
    assert.equal(calls, 1)
  }
  const failed = await collectWebFeedReaderMaintenance({ now, reader: async () => { throw new Error('parse drift') }, sourceCheck, projectHead, acceptedState, sourceWatchList, projectCatalog })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals.at(-1).action, 'restore-registered-feed-access')
})

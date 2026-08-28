import assert from 'node:assert/strict'
import test from 'node:test'
import { collectYouTubePublicVideoSearchMaintenance } from '../src/index.mjs'

test('stays a candidate without approved identity and a current live report', () => {
  assert.equal(collectYouTubePublicVideoSearchMaintenance().status, 'candidate-awaiting-approved-identity-and-live-probe')
})
test('proposes review for source drift and never admits directly', () => {
  const result = collectYouTubePublicVideoSearchMaintenance({ sourceChanges: [{ id: 'youtube-policy', previous: 'a', current: 'b' }] })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].kind, 'knowledge-proposal')
})

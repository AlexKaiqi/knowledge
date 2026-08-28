import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileFeedbackObservations } from '../src/index.mjs'

const d = (character) => `sha256:${character.repeat(64)}`
const base = {
  sourceRef: 'source:owned-comments',
  targetRef: 'release:demo-v1',
  priorWindow: {
    observedAt: '2026-08-26T00:00:00Z', completeness: 'complete', checkpointRef: 'cursor:1',
    items: [
      { itemRef: 'comment:edited', contentDigest: d('a'), lifecycle: 'visible', replyState: 'unanswered' },
      { itemRef: 'comment:missing', contentDigest: d('b'), lifecycle: 'visible', replyState: 'unknown' },
      { itemRef: 'comment:deleted', contentDigest: d('c'), lifecycle: 'visible', replyState: 'replied' },
      { itemRef: 'comment:same', contentDigest: d('d'), lifecycle: 'visible', replyState: 'unknown' },
    ],
  },
  currentWindow: {
    observedAt: '2026-08-27T00:00:00Z', completeness: 'complete', checkpointRef: 'cursor:2',
    items: [
      { itemRef: 'comment:new', contentDigest: d('e'), lifecycle: 'visible', replyState: 'unanswered' },
      { itemRef: 'comment:edited', contentDigest: d('f'), lifecycle: 'visible', replyState: 'replied' },
      { itemRef: 'comment:deleted', lifecycle: 'deleted', replyState: 'replied' },
      { itemRef: 'comment:same', contentDigest: d('d'), lifecycle: 'visible', replyState: 'unknown' },
    ],
  },
}

test('reconciles new, edited, reply, explicit deletion and unchanged observations', () => {
  const result = reconcileFeedbackObservations(base)
  assert.deepEqual(result.changes.find((item) => item.itemRef === 'comment:edited').mutations, ['edited', 'reply-state-changed'])
  assert.deepEqual(result.changes.find((item) => item.itemRef === 'comment:deleted').mutations, ['deleted'])
  assert.deepEqual(result.changes.find((item) => item.itemRef === 'comment:new').mutations, ['new'])
  assert.deepEqual(result.changes.find((item) => item.itemRef === 'comment:same').mutations, ['unchanged'])
  assert.equal(result.executionAuthorized, false)
})

test('absence remains unresolved even for a complete current window', () => {
  const result = reconcileFeedbackObservations(base)
  assert.deepEqual(result.missingUnresolved, [{ itemRef: 'comment:missing', prior: { lifecycle: 'visible', replyState: 'unknown', contentDigest: d('b') }, reason: 'not-observed-current-window', deletionInferred: false }])
  assert.equal(result.deletionInferencePolicy, 'explicit-lifecycle-only')
})

test('checkpoint advancement is only a proposal from a complete observed window', () => {
  assert.deepEqual(reconcileFeedbackObservations(base).checkpointRecommendation, { action: 'propose-advance', checkpointRef: 'cursor:2', reason: 'complete-current-window' })
  const partial = reconcileFeedbackObservations({ ...base, currentWindow: { ...base.currentWindow, completeness: 'partial' } })
  assert.deepEqual(partial.checkpointRecommendation, { action: 'hold', reason: 'partial-current-window' })
})

test('same normalized observations produce the same ordered result digest', () => {
  const reversed = {
    ...base,
    priorWindow: { ...base.priorWindow, items: [...base.priorWindow.items].reverse() },
    currentWindow: { ...base.currentWindow, items: [...base.currentWindow.items].reverse() },
  }
  assert.deepEqual(reconcileFeedbackObservations(base), reconcileFeedbackObservations(reversed))
})

test('rejects text, identity fields, invalid tombstones, duplicate ids and reversed time', () => {
  assert.throws(() => reconcileFeedbackObservations({ ...base, currentWindow: { ...base.currentWindow, items: [{ ...base.currentWindow.items[0], body: 'must not enter' }] } }), /unsupported fields/)
  assert.throws(() => reconcileFeedbackObservations({ ...base, currentWindow: { ...base.currentWindow, items: [{ itemRef: 'comment:x', lifecycle: 'deleted', replyState: 'unknown', contentDigest: d('a') }] } }), /must be absent/)
  assert.throws(() => reconcileFeedbackObservations({ ...base, currentWindow: { ...base.currentWindow, items: [base.currentWindow.items[0], base.currentWindow.items[0]] } }), /must be unique/)
  assert.throws(() => reconcileFeedbackObservations({ ...base, currentWindow: { ...base.currentWindow, observedAt: '2026-08-25T00:00:00Z' } }), /must not precede/)
})

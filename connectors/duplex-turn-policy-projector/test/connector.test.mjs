import assert from 'node:assert/strict'
import test from 'node:test'
import { projectDuplexTurnEventsToActions } from '../src/index.mjs'

const trace = [
  { kind: 'assistant-output', atMs: 0, state: 'started' },
  { kind: 'speech-candidate', atMs: 100, candidateId: 'noise-1', state: 'started' },
  { kind: 'speech-candidate', atMs: 180, candidateId: 'noise-1', state: 'released' },
  { kind: 'speech-candidate', atMs: 300, candidateId: 'ack-1', state: 'started' },
  { kind: 'speech-confirmation', atMs: 420, candidateId: 'ack-1', intent: 'backchannel' },
  { kind: 'speech-candidate', atMs: 600, candidateId: 'turn-1', state: 'started' },
  { kind: 'speech-confirmation', atMs: 984, candidateId: 'turn-1', intent: 'take-turn' },
  { kind: 'user-turn', atMs: 1400, state: 'ended' }
]

test('keeps candidate handling reversible until a turn-take is confirmed', () => {
  const result = projectDuplexTurnEventsToActions({ trace })
  assert.deepEqual(result.decisions.map((item) => item.actions.map((action) => action.type)), [
    [], ['duck-output'], ['restore-output'], ['duck-output'], ['restore-output', 'record-backchannel'], ['duck-output'], ['cancel-output', 'open-user-turn'], ['commit-user-turn']
  ])
  assert.deepEqual(result.coverage, { eventsProcessed: 8, candidatesObserved: 3, reversibleReleases: 1, backchannels: 1, destructiveCancels: 1, rawAudioAccepted: false, transcriptAccepted: false })
  assert.equal(result.observations[2].latencyMs, 384)
})

test('opens a user turn without cancellation while output is inactive', () => {
  const result = projectDuplexTurnEventsToActions({ trace: [
    { kind: 'speech-candidate', atMs: 0, candidateId: 'turn', state: 'started' },
    { kind: 'speech-confirmation', atMs: 50, candidateId: 'turn', intent: 'take-turn' },
    { kind: 'user-turn', atMs: 100, state: 'ended' }
  ] })
  assert.deepEqual(result.decisions[1].actions.map((action) => action.type), ['open-user-turn'])
  assert.equal(result.coverage.destructiveCancels, 0)
})

test('rejects private media and transcript fields', () => {
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [{ kind: 'assistant-output', atMs: 0, state: 'started', rawAudio: 'secret' }] }), /private fields/)
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [{ kind: 'speech-candidate', atMs: 0, candidateId: 'c', state: 'started', transcript: 'secret' }] }), /private fields/)
})

test('rejects unordered, overlapping, stale and incomplete traces', () => {
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [
    { kind: 'speech-candidate', atMs: 2, candidateId: 'a', state: 'started' },
    { kind: 'speech-candidate', atMs: 1, candidateId: 'a', state: 'released' }
  ] }), /ordered/)
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [
    { kind: 'speech-candidate', atMs: 0, candidateId: 'a', state: 'started' },
    { kind: 'speech-candidate', atMs: 1, candidateId: 'b', state: 'started' }
  ] }), /non-overlapping/)
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [{ kind: 'speech-candidate', atMs: 0, candidateId: 'a', state: 'released' }] }), /match/)
  assert.throws(() => projectDuplexTurnEventsToActions({ trace: [{ kind: 'speech-candidate', atMs: 0, candidateId: 'a', state: 'started' }] }), /unresolved/)
})

test('is deterministic', () => {
  assert.deepEqual(projectDuplexTurnEventsToActions({ trace }), projectDuplexTurnEventsToActions({ trace }))
})

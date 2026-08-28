import assert from 'node:assert/strict'
import test from 'node:test'
import { projectPublicStateToPetBehavior } from '../src/index.mjs'

const trace = [
  { kind: 'session-snapshot', atMs: 0, sessions: [{ id: 'session.alpha', running: true, pendingInteraction: false }], jobStatuses: ['running'] },
  { kind: 'session-snapshot', atMs: 10, sessions: [{ id: 'session.alpha', running: true, pendingInteraction: true }], jobStatuses: ['running'] },
  { kind: 'assistant-state', atMs: 20, available: true, phase: 'speaking', status: 'ready' },
  { kind: 'session-snapshot', atMs: 30, sessions: [{ id: 'session.alpha', running: false, pendingInteraction: false }], jobStatuses: ['completed'] },
  { kind: 'session-snapshot', atMs: 40, sessions: [{ id: 'session.alpha', running: false, pendingInteraction: false }], jobStatuses: ['failed'] },
]

test('projects public state edges into stable baselines and one-shot pulses', () => {
  const result = projectPublicStateToPetBehavior({ trace })
  assert.deepEqual(result.decisions.map((item) => item.baseline.action), ['running', 'running', 'running', 'idle', 'idle'])
  assert.deepEqual(result.decisions.map((item) => item.pulse?.action ?? null), [null, 'waiting', 'waving', 'review', 'failed'])
  assert.equal(result.decisions[4].pulse.priority, 100)
  assert.deepEqual(result.finalBaseline, { action: 'idle', mode: 'loop' })
})

test('first session snapshot primes edges without replaying stale failure or waiting state', () => {
  const result = projectPublicStateToPetBehavior({ trace: [
    { kind: 'session-snapshot', atMs: 0, sessions: [{ id: 's', running: false, pendingInteraction: true }], jobStatuses: ['failed'] },
  ] })
  assert.equal(result.decisions[0].pulse, null)
})

test('failure outranks waiting and completion on the same snapshot edge', () => {
  const result = projectPublicStateToPetBehavior({ trace: [
    { kind: 'session-snapshot', atMs: 0, sessions: [{ id: 's', running: true, pendingInteraction: false }], jobStatuses: ['running'] },
    { kind: 'session-snapshot', atMs: 1, sessions: [{ id: 's', running: false, pendingInteraction: true }], jobStatuses: ['failed'] },
  ] })
  assert.deepEqual(result.decisions[1].pulse, { action: 'failed', mode: 'once', priority: 100, reason: 'job-failed' })
})

test('assistant lifecycle mapping covers the production public vocabulary', () => {
  const phases = ['connecting', 'listening', 'speaking', 'responding', 'editing', 'drafting', 'ready', 'submitted', 'idle']
  const result = projectPublicStateToPetBehavior({ trace: phases.map((phase, index) => ({ kind: 'assistant-state', atMs: index, available: true, status: 'ready', phase })) })
  assert.deepEqual(result.decisions.map((item) => item.pulse?.action ?? null), ['waiting', 'waiting', 'waving', 'waving', 'jumping', 'jumping', 'review', 'review', null])
})

test('rejects private text and hidden execution fields', () => {
  assert.throws(() => projectPublicStateToPetBehavior({ trace: [{ kind: 'assistant-state', atMs: 0, available: true, phase: 'speaking', transcript: 'secret' }] }), /non-public fields/)
  assert.throws(() => projectPublicStateToPetBehavior({ trace: [{ kind: 'session-snapshot', atMs: 0, sessions: [], jobStatuses: [], prompt: 'secret' }] }), /non-public fields/)
})

test('is deterministic and rejects unordered or duplicate session state', () => {
  assert.deepEqual(projectPublicStateToPetBehavior({ trace }), projectPublicStateToPetBehavior({ trace }))
  assert.throws(() => projectPublicStateToPetBehavior({ trace: [
    { kind: 'assistant-state', atMs: 2, available: true, phase: 'idle' },
    { kind: 'assistant-state', atMs: 1, available: true, phase: 'idle' },
  ] }), /ordered/)
  assert.throws(() => projectPublicStateToPetBehavior({ trace: [{ kind: 'session-snapshot', atMs: 0, sessions: [
    { id: 'same', running: true, pendingInteraction: false },
    { id: 'same', running: false, pendingInteraction: false },
  ], jobStatuses: [] }] }), /unique/)
})

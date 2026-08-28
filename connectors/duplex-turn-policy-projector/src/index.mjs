import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['trace'])
const EVENT_KEYS = new Set(['kind', 'atMs', 'candidateId', 'state', 'intent'])
const KINDS = new Set(['assistant-output', 'speech-candidate', 'speech-confirmation', 'user-turn'])
const ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported or private fields: ${unknown.join(', ')}`)
}

function normalizeEvent(event, index) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error(`trace[${index}] must be an object`)
  assertExactKeys(event, EVENT_KEYS, `trace[${index}]`)
  if (!KINDS.has(event.kind)) throw new Error(`trace[${index}] has an unsupported kind`)
  if (!Number.isInteger(event.atMs) || event.atMs < 0) throw new Error(`trace[${index}].atMs must be a non-negative integer`)

  if (event.kind === 'assistant-output') {
    if (!['started', 'ended'].includes(event.state) || event.candidateId !== undefined || event.intent !== undefined) throw new Error('assistant-output requires only state started|ended')
    return { kind: event.kind, atMs: event.atMs, state: event.state }
  }
  if (event.kind === 'speech-candidate') {
    if (!ID_PATTERN.test(event.candidateId ?? '') || !['started', 'released'].includes(event.state) || event.intent !== undefined) throw new Error('speech-candidate requires a bounded candidateId and state started|released')
    return { kind: event.kind, atMs: event.atMs, candidateId: event.candidateId, state: event.state }
  }
  if (event.kind === 'speech-confirmation') {
    if (!ID_PATTERN.test(event.candidateId ?? '') || !['take-turn', 'backchannel'].includes(event.intent) || event.state !== undefined) throw new Error('speech-confirmation requires a bounded candidateId and intent take-turn|backchannel')
    return { kind: event.kind, atMs: event.atMs, candidateId: event.candidateId, intent: event.intent }
  }
  if (event.state !== 'ended' || event.candidateId !== undefined || event.intent !== undefined) throw new Error('user-turn requires only state ended')
  return { kind: event.kind, atMs: event.atMs, state: event.state }
}

export function normalizeDuplexTurnInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  assertExactKeys(input, INPUT_KEYS, 'input')
  if (!Array.isArray(input.trace) || input.trace.length < 1 || input.trace.length > 200) throw new Error('trace must contain between 1 and 200 events')
  let previousAtMs = -1
  const trace = input.trace.map((event, index) => {
    const normalized = normalizeEvent(event, index)
    if (normalized.atMs < previousAtMs) throw new Error('trace must be ordered by atMs')
    previousAtMs = normalized.atMs
    return normalized
  })
  return { trace }
}

function action(type, reason, candidateId) {
  return { type, reason, ...(candidateId ? { candidateId } : {}) }
}

export function projectDuplexTurnEventsToActions(input) {
  const normalized = normalizeDuplexTurnInput(input)
  let output = 'inactive'
  let userTurn = 'closed'
  let activeCandidate = null
  const seenCandidates = new Set()
  const observations = []
  let destructiveCancels = 0
  let reversibleReleases = 0
  let backchannels = 0

  const decisions = normalized.trace.map((event) => {
    const actions = []
    if (event.kind === 'assistant-output') {
      if (event.state === 'started') {
        if (output !== 'inactive' || userTurn === 'open') throw new Error('assistant output cannot start while output or user turn is active')
        output = 'playing'
      } else {
        if (output === 'inactive') throw new Error('assistant output cannot end while inactive')
        output = 'inactive'
      }
    } else if (event.kind === 'speech-candidate' && event.state === 'started') {
      if (activeCandidate || seenCandidates.has(event.candidateId) || userTurn === 'open') throw new Error('speech candidate must be unique and non-overlapping')
      activeCandidate = { id: event.candidateId, startedAtMs: event.atMs, ducked: output === 'playing' }
      seenCandidates.add(event.candidateId)
      if (activeCandidate.ducked) {
        output = 'ducked'
        actions.push(action('duck-output', 'speech-candidate-pending', event.candidateId))
      }
    } else if (event.kind === 'speech-candidate') {
      if (!activeCandidate || activeCandidate.id !== event.candidateId) throw new Error('released candidate must match the active candidate')
      if (activeCandidate.ducked && output === 'ducked') {
        output = 'playing'
        actions.push(action('restore-output', 'speech-candidate-released', event.candidateId))
      }
      observations.push({ candidateId: event.candidateId, outcome: 'released', latencyMs: event.atMs - activeCandidate.startedAtMs, outputCancelled: false })
      reversibleReleases += 1
      activeCandidate = null
    } else if (event.kind === 'speech-confirmation') {
      if (!activeCandidate || activeCandidate.id !== event.candidateId) throw new Error('confirmation must match the active candidate')
      const latencyMs = event.atMs - activeCandidate.startedAtMs
      if (event.intent === 'backchannel') {
        if (activeCandidate.ducked && output === 'ducked') {
          output = 'playing'
          actions.push(action('restore-output', 'backchannel-does-not-take-turn', event.candidateId))
        }
        actions.push(action('record-backchannel', 'confirmed-backchannel', event.candidateId))
        observations.push({ candidateId: event.candidateId, outcome: 'backchannel', latencyMs, outputCancelled: false })
        backchannels += 1
      } else {
        if (output === 'playing' || output === 'ducked') {
          output = 'inactive'
          actions.push(action('cancel-output', 'confirmed-turn-take', event.candidateId))
          destructiveCancels += 1
        }
        userTurn = 'open'
        actions.push(action('open-user-turn', 'confirmed-turn-take', event.candidateId))
        observations.push({ candidateId: event.candidateId, outcome: 'take-turn', latencyMs, outputCancelled: actions.some((item) => item.type === 'cancel-output') })
      }
      activeCandidate = null
    } else {
      if (userTurn !== 'open') throw new Error('user turn cannot end before it is opened')
      userTurn = 'closed'
      actions.push(action('commit-user-turn', 'user-turn-ended'))
    }
    return { kind: event.kind, atMs: event.atMs, actions, state: { output, userTurn, activeCandidateId: activeCandidate?.id ?? null } }
  })

  if (activeCandidate) throw new Error('trace ends with an unresolved speech candidate')
  if (userTurn === 'open') throw new Error('trace ends with an uncommitted user turn')
  const payload = {
    schemaVersion: 'dsh.duplex-turn-action-plan/v1',
    decisions,
    observations,
    finalState: { output, userTurn, activeCandidateId: null },
    coverage: {
      eventsProcessed: decisions.length,
      candidatesObserved: observations.length,
      reversibleReleases,
      backchannels,
      destructiveCancels,
      rawAudioAccepted: false,
      transcriptAccepted: false
    }
  }
  return { ...payload, resultDigest: digest(payload) }
}

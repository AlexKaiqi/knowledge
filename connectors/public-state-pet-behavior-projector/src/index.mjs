import { createHash } from 'node:crypto'

const SESSION_KEYS = new Set(['kind', 'atMs', 'sessions', 'jobStatuses'])
const ASSISTANT_KEYS = new Set(['kind', 'atMs', 'available', 'status', 'phase'])
const SESSION_ITEM_KEYS = new Set(['id', 'running', 'pendingInteraction'])
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed'])
const ASSISTANT_STATUSES = new Set(['idle', 'opening', 'ready', 'error'])
const ASSISTANT_PHASES = new Set(['idle', 'connecting', 'listening', 'speaking', 'responding', 'editing', 'drafting', 'ready', 'submitted'])

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains non-public fields: ${unknown.join(', ')}`)
}

function assertAtMs(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error('atMs must be a non-negative integer')
}

function normalizeSessionEvent(event) {
  assertExactKeys(event, SESSION_KEYS, 'session-snapshot')
  assertAtMs(event.atMs)
  if (!Array.isArray(event.sessions) || event.sessions.length > 50) throw new Error('sessions must contain at most 50 items')
  const ids = new Set()
  const sessions = event.sessions.map((session, index) => {
    if (!session || typeof session !== 'object' || Array.isArray(session)) throw new Error(`sessions[${index}] must be an object`)
    assertExactKeys(session, SESSION_ITEM_KEYS, `sessions[${index}]`)
    if (typeof session.id !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(session.id)) throw new Error(`sessions[${index}].id must be opaque and bounded`)
    if (ids.has(session.id)) throw new Error('session ids must be unique within a snapshot')
    ids.add(session.id)
    if (typeof session.running !== 'boolean' || typeof session.pendingInteraction !== 'boolean') throw new Error(`sessions[${index}] state must be boolean`)
    return { id: session.id, running: session.running, pendingInteraction: session.pendingInteraction }
  })
  if (!Array.isArray(event.jobStatuses) || event.jobStatuses.length > 100 || event.jobStatuses.some((status) => !JOB_STATUSES.has(status))) throw new Error('jobStatuses contains an unsupported status')
  return { kind: event.kind, atMs: event.atMs, sessions, jobStatuses: [...event.jobStatuses] }
}

function normalizeAssistantEvent(event) {
  assertExactKeys(event, ASSISTANT_KEYS, 'assistant-state')
  assertAtMs(event.atMs)
  if (typeof event.available !== 'boolean') throw new Error('available must be boolean')
  if (event.status !== undefined && !ASSISTANT_STATUSES.has(event.status)) throw new Error('unsupported assistant status')
  if (event.phase !== undefined && !ASSISTANT_PHASES.has(event.phase)) throw new Error('unsupported assistant phase')
  if (event.status === undefined && event.phase === undefined) throw new Error('assistant-state requires status or phase')
  return {
    kind: event.kind,
    atMs: event.atMs,
    available: event.available,
    ...(event.status === undefined ? {} : { status: event.status }),
    ...(event.phase === undefined ? {} : { phase: event.phase }),
  }
}

export function normalizeProjectionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  assertExactKeys(input, new Set(['trace']), 'input')
  if (!Array.isArray(input.trace) || input.trace.length < 1 || input.trace.length > 100) throw new Error('trace must contain between 1 and 100 events')
  let previousAtMs = -1
  const trace = input.trace.map((event, index) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error(`trace[${index}] must be an object`)
    const normalized = event.kind === 'session-snapshot'
      ? normalizeSessionEvent(event)
      : event.kind === 'assistant-state'
        ? normalizeAssistantEvent(event)
        : (() => { throw new Error(`unsupported event kind: ${event.kind}`) })()
    if (normalized.atMs < previousAtMs) throw new Error('trace must be ordered by atMs')
    previousAtMs = normalized.atMs
    return normalized
  })
  return { trace }
}

function pulse(action, priority, reason) {
  return { action, mode: 'once', priority, reason }
}

function assistantPulse(event) {
  const phase = event.phase ?? event.status
  if (event.status === 'error') return pulse('failed', 100, 'assistant-error')
  if (phase === 'speaking' || phase === 'responding') return pulse('waving', 65, 'assistant-speaking')
  if (phase === 'editing' || phase === 'drafting') return pulse('jumping', 70, 'assistant-editing')
  if (phase === 'ready' || phase === 'submitted') return pulse('review', 75, 'assistant-ready')
  if (phase === 'connecting' || phase === 'listening' || event.status === 'opening') return pulse('waiting', 60, 'assistant-waiting')
  return null
}

export function projectPublicStateToPetBehavior(input) {
  const normalized = normalizeProjectionInput(input)
  const previousRunning = new Map()
  const previousWaiting = new Set()
  let previousFailed = false
  let sessionStreamPrimed = false
  let baseAction = 'idle'

  const decisions = normalized.trace.map((event) => {
    let nextPulse = null
    if (event.kind === 'session-snapshot') {
      let working = false
      let waiting = false
      let finished = false
      for (const session of event.sessions) {
        if (previousRunning.get(session.id) === true && !session.running) finished = true
        previousRunning.set(session.id, session.running)
        working ||= session.running
        if (session.pendingInteraction) {
          if (!previousWaiting.has(session.id)) waiting = true
          previousWaiting.add(session.id)
        } else {
          previousWaiting.delete(session.id)
        }
      }
      const failed = event.jobStatuses.includes('failed')
      baseAction = working ? 'running' : 'idle'
      if (sessionStreamPrimed) {
        if (failed && !previousFailed) nextPulse = pulse('failed', 100, 'job-failed')
        else if (waiting) nextPulse = pulse('waiting', 80, 'interaction-required')
        else if (finished) nextPulse = pulse('review', 70, 'task-finished')
      } else {
        sessionStreamPrimed = true
      }
      previousFailed = failed
    } else {
      nextPulse = assistantPulse(event)
    }
    return {
      kind: event.kind,
      atMs: event.atMs,
      baseline: { action: baseAction, mode: 'loop' },
      pulse: nextPulse,
    }
  })

  const payload = {
    schemaVersion: 'dsh.pet-behavior-projection/v1',
    decisions,
    finalBaseline: { action: baseAction, mode: 'loop' },
    coverage: {
      eventsProcessed: decisions.length,
      sessionStreamPrimed,
      acceptedStateSurface: ['session-running', 'pending-interaction', 'job-status', 'assistant-status', 'assistant-phase'],
      privateTextAccepted: false,
    },
  }
  return { ...payload, resultDigest: digest(payload) }
}

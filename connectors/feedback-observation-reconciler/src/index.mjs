import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['sourceRef', 'targetRef', 'priorWindow', 'currentWindow'])
const WINDOW_KEYS = new Set(['observedAt', 'completeness', 'checkpointRef', 'items'])
const ITEM_KEYS = new Set(['itemRef', 'contentDigest', 'lifecycle', 'replyState'])
const LIFECYCLES = new Set(['visible', 'deleted', 'hidden'])
const REPLY_STATES = new Set(['unanswered', 'replied', 'unknown'])
const DIGEST = /^sha256:[0-9a-f]{64}$/
const SAFE_ITEM_REF = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

function digest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function assertOpaqueRef(value, name, pattern = null) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500 || (pattern && !pattern.test(value))) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function normalizeItem(item, name) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(item).filter((key) => !ITEM_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
  const lifecycle = item.lifecycle ?? 'visible'
  const replyState = item.replyState ?? 'unknown'
  if (!LIFECYCLES.has(lifecycle)) throw new Error(`${name}.lifecycle is unsupported`)
  if (!REPLY_STATES.has(replyState)) throw new Error(`${name}.replyState is unsupported`)
  if (lifecycle === 'visible' && !DIGEST.test(item.contentDigest ?? '')) throw new Error(`${name}.contentDigest is required for visible items`)
  if (lifecycle !== 'visible' && item.contentDigest !== undefined) throw new Error(`${name}.contentDigest must be absent for lifecycle tombstones`)
  return {
    itemRef: assertOpaqueRef(item.itemRef, `${name}.itemRef`, SAFE_ITEM_REF),
    lifecycle,
    replyState,
    ...(item.contentDigest === undefined ? {} : { contentDigest: item.contentDigest }),
  }
}

function normalizeWindow(window, name) {
  if (!window || typeof window !== 'object' || Array.isArray(window)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(window).filter((key) => !WINDOW_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
  if (!['partial', 'complete'].includes(window.completeness)) throw new Error(`${name}.completeness is unsupported`)
  if (typeof window.observedAt !== 'string' || !Number.isFinite(Date.parse(window.observedAt))) throw new Error(`${name}.observedAt must be RFC 3339`)
  if (!Array.isArray(window.items) || window.items.length > 500) throw new Error(`${name}.items must contain at most 500 observations`)
  const items = window.items.map((item, index) => normalizeItem(item, `${name}.items[${index}]`)).sort((left, right) => left.itemRef.localeCompare(right.itemRef))
  if (new Set(items.map((item) => item.itemRef)).size !== items.length) throw new Error(`${name}.itemRef values must be unique`)
  return {
    observedAt: new Date(window.observedAt).toISOString(),
    completeness: window.completeness,
    ...(window.checkpointRef === undefined ? {} : { checkpointRef: assertOpaqueRef(window.checkpointRef, `${name}.checkpointRef`) }),
    items,
  }
}

export function normalizeFeedbackReconciliationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  const priorWindow = normalizeWindow(input.priorWindow, 'priorWindow')
  const currentWindow = normalizeWindow(input.currentWindow, 'currentWindow')
  if (Date.parse(currentWindow.observedAt) < Date.parse(priorWindow.observedAt)) throw new Error('currentWindow must not precede priorWindow')
  return {
    sourceRef: assertOpaqueRef(input.sourceRef, 'sourceRef'),
    targetRef: assertOpaqueRef(input.targetRef, 'targetRef'),
    priorWindow,
    currentWindow,
  }
}

function state(item) {
  if (!item) return null
  return { lifecycle: item.lifecycle, replyState: item.replyState, ...(item.contentDigest ? { contentDigest: item.contentDigest } : {}) }
}

export function reconcileFeedbackObservations(input) {
  const normalized = normalizeFeedbackReconciliationInput(input)
  const prior = new Map(normalized.priorWindow.items.map((item) => [item.itemRef, item]))
  const current = new Map(normalized.currentWindow.items.map((item) => [item.itemRef, item]))
  const changes = []
  const missingUnresolved = []

  for (const item of normalized.currentWindow.items) {
    const before = prior.get(item.itemRef)
    const mutations = []
    if (!before) {
      mutations.push(item.lifecycle === 'visible' ? 'new' : 'lifecycle-observed')
    } else if (item.lifecycle === 'deleted') {
      mutations.push('deleted')
    } else if (item.lifecycle === 'hidden') {
      mutations.push('hidden')
    } else if (before.lifecycle !== 'visible') {
      mutations.push('resurfaced')
    } else {
      if (before.contentDigest !== item.contentDigest) mutations.push('edited')
      if (before.replyState !== item.replyState) mutations.push('reply-state-changed')
      if (mutations.length === 0) mutations.push('unchanged')
    }
    changes.push({ itemRef: item.itemRef, prior: state(before), current: state(item), mutations })
  }

  for (const item of normalized.priorWindow.items) {
    if (!current.has(item.itemRef)) missingUnresolved.push({ itemRef: item.itemRef, prior: state(item), reason: 'not-observed-current-window', deletionInferred: false })
  }

  const counts = { new: 0, edited: 0, lifecycleObserved: 0, resurfaced: 0, deleted: 0, hidden: 0, replyStateChanged: 0, unchanged: 0, missingUnresolved: missingUnresolved.length }
  const countKeys = { new: 'new', edited: 'edited', 'lifecycle-observed': 'lifecycleObserved', resurfaced: 'resurfaced', deleted: 'deleted', hidden: 'hidden', 'reply-state-changed': 'replyStateChanged', unchanged: 'unchanged' }
  for (const change of changes) for (const mutation of change.mutations) counts[countKeys[mutation]] += 1
  const checkpointRecommendation = normalized.currentWindow.completeness === 'complete' && normalized.currentWindow.checkpointRef
    ? { action: 'propose-advance', checkpointRef: normalized.currentWindow.checkpointRef, reason: 'complete-current-window' }
    : { action: 'hold', reason: normalized.currentWindow.completeness === 'partial' ? 'partial-current-window' : 'checkpoint-not-observed' }
  const payload = {
    schemaVersion: 'dsh.feedback-observation-reconciliation/v1',
    sourceRef: normalized.sourceRef,
    targetRef: normalized.targetRef,
    priorObservedAt: normalized.priorWindow.observedAt,
    currentObservedAt: normalized.currentWindow.observedAt,
    changes,
    missingUnresolved,
    counts,
    checkpointRecommendation,
    deletionInferencePolicy: 'explicit-lifecycle-only',
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: digest(payload) }
}

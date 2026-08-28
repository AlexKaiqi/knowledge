import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['currentSessionRef', 'workspaceRef', 'acceptUnconfirmedKnowledgeProposals'])
const PROVIDER_KEYS = new Set(['status', 'reason', 'current', 'reconciledSessionRefs', 'checkpointAdvancedSessionRefs', 'skippedSessionRefs', 'proposalIds', 'durableKnowledgeModified', 'gitCommitted'])
const CURRENT_KEYS = new Set(['path', 'hash', 'chars', 'sessionReferences'])
const SESSION_REF = /^session:[A-Za-z0-9._-]{1,128}$/
const WORKSPACE_REF = /^workspace:[A-Za-z0-9._-]{1,128}$/
const PROPOSAL_ID = /^[A-Za-z0-9._-]{1,128}$/
const STATUSES = new Set(['reconciled', 'no-observed-session-increments', 'partial', 'unavailable'])
const REASONS = new Set(['no-session-query', 'no-text-model', 'reconciliation-failed'])

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const resultDigest = (value) => `sha256:${sha256(JSON.stringify(value))}`

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function exact(value, allowed, name) {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key))
  if (unsupported.length > 0) throw new Error(`${name} contains unsupported fields: ${unsupported.join(', ')}`)
}

function normalizeInput(input) {
  record(input, 'input')
  exact(input, INPUT_KEYS, 'input')
  if (typeof input.currentSessionRef !== 'string' || !SESSION_REF.test(input.currentSessionRef)) throw new Error('currentSessionRef must be an opaque current Session reference')
  if (typeof input.workspaceRef !== 'string' || !WORKSPACE_REF.test(input.workspaceRef)) throw new Error('workspaceRef must be an opaque owner-bound Workspace reference')
  if (input.acceptUnconfirmedKnowledgeProposals !== true) throw new Error('acceptUnconfirmedKnowledgeProposals must be true')
  return { currentSessionRef: input.currentSessionRef, workspaceRef: input.workspaceRef, acceptUnconfirmedKnowledgeProposals: true }
}

function sessionRefs(values, name, currentSessionRef) {
  if (!Array.isArray(values) || values.length > 12 || values.some((value) => typeof value !== 'string' || !SESSION_REF.test(value))) throw new Error(`${name} must contain at most 12 opaque Session references`)
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`)
  if (values.includes(currentSessionRef)) throw new Error(`${name} must exclude the current Session`)
  return [...values]
}

function proposalIds(values) {
  if (!Array.isArray(values) || values.length > 48 || values.some((value) => typeof value !== 'string' || !PROPOSAL_ID.test(value))) throw new Error('provider proposal ids are invalid')
  if (new Set(values).size !== values.length) throw new Error('provider proposal ids must be unique')
  return [...values]
}

function normalizeCurrent(value, currentSessionRef) {
  if (value === null) return null
  record(value, 'provider current')
  exact(value, CURRENT_KEYS, 'provider current')
  if (value.path !== '.pkb/current.md') throw new Error('provider current path drift')
  if (typeof value.hash !== 'string' || !/^[0-9a-f]{64}$/.test(value.hash)) throw new Error('provider current digest is invalid')
  if (!Number.isInteger(value.chars) || value.chars < 1 || value.chars > 5000) throw new Error('provider current character count is invalid')
  const refs = sessionRefs(value.sessionReferences, 'provider current sessionReferences', currentSessionRef)
  if (refs.length < 1) throw new Error('provider current must cite at least one reconciled prior Session')
  return { digest: `sha256:${value.hash}`, chars: value.chars }
}

function normalizeProvider(value, input) {
  record(value, 'provider result')
  exact(value, PROVIDER_KEYS, 'provider result')
  if (!STATUSES.has(value.status)) throw new Error('provider status is invalid')
  if (value.reason !== null && !REASONS.has(value.reason)) throw new Error('provider reason is invalid')
  if (value.durableKnowledgeModified !== false || value.gitCommitted !== false) throw new Error('provider crossed the unconfirmed-proposal boundary')
  const reconciled = sessionRefs(value.reconciledSessionRefs, 'reconciledSessionRefs', input.currentSessionRef)
  const checkpointed = sessionRefs(value.checkpointAdvancedSessionRefs, 'checkpointAdvancedSessionRefs', input.currentSessionRef)
  const skipped = sessionRefs(value.skippedSessionRefs, 'skippedSessionRefs', input.currentSessionRef)
  if (reconciled.some((item) => skipped.includes(item))) throw new Error('reconciled and skipped Session references must be disjoint')
  const proposals = proposalIds(value.proposalIds)
  const current = normalizeCurrent(value.current, input.currentSessionRef)
  if (value.status === 'no-observed-session-increments') {
    if (value.reason !== null || current !== null || reconciled.length || checkpointed.length || skipped.length || proposals.length) throw new Error('no-observed-session-increments contains mutation facts')
  } else if (value.status === 'reconciled') {
    if (value.reason !== null || reconciled.length < 1 || current === null) throw new Error('reconciled provider result is incomplete')
  } else if (value.status === 'partial') {
    if (value.reason === null || reconciled.length < 1 || skipped.length < 1 || current === null) throw new Error('partial provider result is incomplete')
  } else if (value.reason === null || reconciled.length > 0 || current !== null || proposals.length > 0) {
    throw new Error('unavailable provider result contains success facts')
  }
  return { status: value.status, reason: value.reason, current, reconciled, checkpointed, skipped, proposals }
}

export async function reconcileCurrentWorkProjection(input, { reconcilePersistedSessions } = {}) {
  const normalized = normalizeInput(input)
  if (typeof reconcilePersistedSessions !== 'function') throw new Error('reconcilePersistedSessions provider is required')
  const provider = normalizeProvider(await reconcilePersistedSessions({
    currentSessionId: normalized.currentSessionRef.slice('session:'.length),
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    excludeCurrentSession: true,
    acceptUnconfirmedKnowledgeProposals: true,
  }), normalized)
  const payload = {
    schemaVersion: 'dsh.current-work-projection-reconciliation/v1',
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    status: provider.status,
    reason: provider.reason,
    currentProjectionRef: '.pkb/current.md',
    currentProjectionDigest: provider.current?.digest ?? null,
    currentProjectionChars: provider.current?.chars ?? null,
    reconciledSessionRefs: provider.reconciled,
    checkpointAdvancedSessionRefs: provider.checkpointed,
    skippedSessionRefs: provider.skipped,
    proposalRefs: provider.proposals.map((id) => `knowledge-proposal:${id}`),
    coverage: {
      sessionInput: 'unconsumed-persisted-session-events',
      recentSessionLimit: 12,
      currentSessionExcluded: true,
      sessionEnumerationComplete: false,
      sourceFailuresFullyObservable: false,
      rawSessionTextReturned: false,
      fullProjectionRebuild: false,
      cursorReset: false,
      proposalsUnconfirmed: true,
      proposalLimitPerReconciledSession: 4,
      modelOutputHumanReviewed: false,
    },
    currentProjectionModified: provider.current !== null,
    checkpointsModified: provider.checkpointed.length > 0,
    sessionHistoryModified: false,
    durableKnowledgeModified: false,
    gitCommitted: false,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: resultDigest(payload) }
}

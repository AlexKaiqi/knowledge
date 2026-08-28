import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['currentSessionRef', 'workspaceRef', 'instruction', 'acceptUnconfirmedKnowledgeProposals'])
const PROVIDER_KEYS = new Set(['status', 'reason', 'current', 'proposalIds', 'checkpointAdvanced', 'durableKnowledgeModified', 'gitCommitted'])
const CURRENT_KEYS = new Set(['path', 'hash', 'chars', 'sessionReferences'])
const SESSION_REF = /^session:[A-Za-z0-9._-]{1,128}$/
const WORKSPACE_REF = /^workspace:[A-Za-z0-9._-]{1,128}$/
const PROPOSAL_ID = /^[A-Za-z0-9._-]{1,128}$/
const SKIP_REASONS = new Set(['no-text', 'no-text-model', 'curate-cooldown'])

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const resultDigest = (value) => `sha256:${sha256(JSON.stringify(value))}`

function assertRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function normalizeInput(input) {
  assertRecord(input, 'input')
  assertExactKeys(input, INPUT_KEYS, 'input')
  if (typeof input.currentSessionRef !== 'string' || !SESSION_REF.test(input.currentSessionRef)) throw new Error('currentSessionRef must be an opaque current Session reference')
  if (typeof input.workspaceRef !== 'string' || !WORKSPACE_REF.test(input.workspaceRef)) throw new Error('workspaceRef must be an opaque owner-bound Workspace reference')
  if (typeof input.instruction !== 'string' || input.instruction.trim().length < 1 || input.instruction.trim().length > 1000 || input.instruction.includes('\0')) throw new Error('instruction must be a non-empty string up to 1000 characters')
  if (input.acceptUnconfirmedKnowledgeProposals !== true) throw new Error('acceptUnconfirmedKnowledgeProposals must be true for this operation')
  return {
    currentSessionRef: input.currentSessionRef,
    workspaceRef: input.workspaceRef,
    instruction: input.instruction.trim(),
    acceptUnconfirmedKnowledgeProposals: true,
  }
}

function normalizeCurrent(value, input) {
  assertRecord(value, 'provider current result')
  assertExactKeys(value, CURRENT_KEYS, 'provider current result')
  if (value.path !== '.pkb/current.md') throw new Error('provider current path drift')
  if (typeof value.hash !== 'string' || !/^[0-9a-f]{64}$/.test(value.hash)) throw new Error('provider current digest is invalid')
  if (!Number.isInteger(value.chars) || value.chars < 1 || value.chars > 5000) throw new Error('provider current character count is invalid')
  if (!Array.isArray(value.sessionReferences) || value.sessionReferences.length < 1 || value.sessionReferences.length > 50 || value.sessionReferences.some((ref) => typeof ref !== 'string' || !SESSION_REF.test(ref))) throw new Error('provider current Session references are invalid')
  if (new Set(value.sessionReferences).size !== value.sessionReferences.length) throw new Error('provider current Session references must be unique')
  if (!value.sessionReferences.includes(input.currentSessionRef)) throw new Error('provider current projection does not cite the current Session')
  return { digest: `sha256:${value.hash}`, chars: value.chars }
}

function normalizeProviderResult(value, input) {
  assertRecord(value, 'provider result')
  assertExactKeys(value, PROVIDER_KEYS, 'provider result')
  if (value.durableKnowledgeModified !== false || value.gitCommitted !== false) throw new Error('provider crossed the unconfirmed-proposal boundary')
  if (typeof value.checkpointAdvanced !== 'boolean') throw new Error('provider checkpoint status is invalid')
  if (!Array.isArray(value.proposalIds) || value.proposalIds.length > 4 || value.proposalIds.some((id) => typeof id !== 'string' || !PROPOSAL_ID.test(id))) throw new Error('provider proposal ids are invalid')
  if (new Set(value.proposalIds).size !== value.proposalIds.length) throw new Error('provider proposal ids must be unique')
  if (value.status === 'updated') {
    if (value.reason !== null) throw new Error('updated provider result must not contain a skip reason')
    const current = normalizeCurrent(value.current, input)
    return { status: 'updated', reason: null, current, proposalIds: value.proposalIds, checkpointAdvanced: value.checkpointAdvanced }
  }
  if (value.status !== 'skipped' || !SKIP_REASONS.has(value.reason)) throw new Error('provider status or skip reason is invalid')
  if (value.current !== null || value.proposalIds.length > 0 || value.checkpointAdvanced) throw new Error('skipped provider result contains mutation facts')
  return { status: 'skipped', reason: value.reason, current: null, proposalIds: [], checkpointAdvanced: false }
}

function publicStatus(provider) {
  if (provider.status === 'updated') return 'updated'
  return ({ 'no-text': 'no-new-session-text', 'no-text-model': 'no-text-model', 'curate-cooldown': 'cooldown' })[provider.reason]
}

export async function maintainCurrentWorkProjection(input, { curateCurrentSession } = {}) {
  const normalized = normalizeInput(input)
  if (typeof curateCurrentSession !== 'function') throw new Error('curateCurrentSession provider is required')
  const providerResult = await curateCurrentSession({
    currentSessionId: normalized.currentSessionRef.slice('session:'.length),
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    instruction: normalized.instruction,
    acceptUnconfirmedKnowledgeProposals: true,
  })
  const provider = normalizeProviderResult(providerResult, normalized)
  const updated = provider.status === 'updated'
  const payload = {
    schemaVersion: 'dsh.current-work-projection-maintenance/v1',
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    status: publicStatus(provider),
    currentProjectionRef: '.pkb/current.md',
    currentProjectionDigest: updated ? provider.current.digest : null,
    currentProjectionChars: updated ? provider.current.chars : null,
    currentSessionSourceIncluded: updated,
    checkpointAdvanced: provider.checkpointAdvanced,
    proposalRefs: provider.proposalIds.map((id) => `knowledge-proposal:${id}`),
    coverage: {
      sessionInput: 'unconsumed-current-session-events',
      rawSessionTextReturned: false,
      currentProjectionComplete: false,
      proposalsUnconfirmed: true,
      proposalLimit: 4,
      modelOutputHumanReviewed: false,
    },
    currentProjectionModified: updated,
    sessionHistoryModified: false,
    durableKnowledgeModified: false,
    gitCommitted: false,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: resultDigest(payload) }
}

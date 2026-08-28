import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['query', 'currentSessionRef', 'workspaceRef', 'maxChars', 'includePriorSessions'])
const PROVIDER_KEYS = new Set(['query', 'sessionId', 'cwd', 'revision', 'hash', 'chars', 'sources', 'text'])
const SESSION_REF = /^session:[A-Za-z0-9._-]{1,128}$/
const WORKSPACE_REF = /^workspace:[A-Za-z0-9._-]{1,128}$/
const DURABLE_REF = /^knowledge\/[A-Za-z0-9._-]{1,128}\.md$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const resultDigest = (value) => sha256(JSON.stringify(value))

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
  if (typeof input.query !== 'string' || input.query.length > 500 || input.query.includes('\0')) throw new Error('query must be a string up to 500 characters')
  const query = input.query.trim()
  if (typeof input.currentSessionRef !== 'string' || !SESSION_REF.test(input.currentSessionRef)) throw new Error('currentSessionRef must be an opaque session reference')
  if (typeof input.workspaceRef !== 'string' || !WORKSPACE_REF.test(input.workspaceRef)) throw new Error('workspaceRef must be an opaque workspace reference')
  if (!Number.isInteger(input.maxChars) || input.maxChars < 1200 || input.maxChars > 12000) throw new Error('maxChars must be an integer from 1200 to 12000')
  if (typeof input.includePriorSessions !== 'boolean') throw new Error('includePriorSessions must be boolean')
  return {
    query,
    currentSessionRef: input.currentSessionRef,
    workspaceRef: input.workspaceRef,
    maxChars: input.maxChars,
    includePriorSessions: input.includePriorSessions,
  }
}

function normalizeSourceRef(value, index) {
  if (typeof value !== 'string') throw new Error(`provider.sources[${index}] must be a string`)
  if (value === '.pkb/current.md' || SESSION_REF.test(value) || DURABLE_REF.test(value)) return value
  throw new Error(`provider.sources[${index}] is not a permitted logical source reference`)
}

function normalizeProviderResult(value, input) {
  assertRecord(value, 'provider result')
  assertExactKeys(value, PROVIDER_KEYS, 'provider result')
  const currentSessionId = input.currentSessionRef.slice('session:'.length)
  if (value.query !== input.query) throw new Error('provider query identity drift')
  if (value.sessionId !== currentSessionId) throw new Error('provider current Session identity drift')
  if (typeof value.cwd !== 'string' || value.cwd.length < 1) throw new Error('provider workspace resolution is missing')
  if (!(value.revision === null || (typeof value.revision === 'string' && value.revision.length > 0))) throw new Error('provider revision is invalid')
  if (typeof value.text !== 'string' || !value.text.startsWith('# Work Context Projection\n') || value.text.includes('\0')) throw new Error('provider text is not a work context projection')
  if (value.text.length > input.maxChars) throw new Error('provider projection exceeds the public character budget')
  if (!Number.isInteger(value.chars) || value.chars !== value.text.length) throw new Error('provider character count drift')
  if (typeof value.hash !== 'string' || value.hash !== sha256(value.text)) throw new Error('provider projection digest drift')
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 12) throw new Error('provider sources must contain 1..12 logical references')
  const sourceRefs = value.sources.map(normalizeSourceRef)
  if (new Set(sourceRefs).size !== sourceRefs.length) throw new Error('provider sources must be unique')
  if (!sourceRefs.includes('.pkb/current.md')) throw new Error('provider projection must include the current-work source')
  if (sourceRefs.includes(input.currentSessionRef)) throw new Error('provider must not return the current Session as a prior-session excerpt')
  if (!input.includePriorSessions && sourceRefs.some((ref) => SESSION_REF.test(ref))) throw new Error('provider returned prior Sessions while disabled')
  return { text: value.text, sourceRefs }
}

export async function readBoundedWorkContext(input, { projectContext } = {}) {
  const normalized = normalizeInput(input)
  if (typeof projectContext !== 'function') throw new Error('projectContext provider is required')
  const currentSessionId = normalized.currentSessionRef.slice('session:'.length)
  const providerResult = await projectContext({
    query: normalized.query,
    currentSessionId,
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    maxChars: Math.max(1000, normalized.maxChars - 128),
    includePriorSessions: normalized.includePriorSessions,
  })
  const projection = normalizeProviderResult(providerResult, normalized)
  const priorSessionCount = projection.sourceRefs.filter((ref) => SESSION_REF.test(ref)).length
  const durableKnowledgeCount = projection.sourceRefs.filter((ref) => DURABLE_REF.test(ref)).length
  const payload = {
    schemaVersion: 'dsh.bounded-work-context/v1',
    query: normalized.query,
    currentSessionRef: normalized.currentSessionRef,
    workspaceRef: normalized.workspaceRef,
    contextText: projection.text,
    contextDigest: `sha256:${sha256(projection.text)}`,
    sourceRefs: projection.sourceRefs,
    coverage: {
      budgetChars: normalized.maxChars,
      renderedChars: projection.text.length,
      sourceCount: projection.sourceRefs.length,
      priorSessionCount,
      durableKnowledgeCount,
      currentWorkIncluded: true,
      currentSessionTranscriptIncluded: false,
      rawTranscriptRetained: false,
      projectionComplete: false,
    },
    retention: 'ephemeral-only',
    sessionHistoryModified: false,
    durableKnowledgeModified: false,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: `sha256:${resultDigest(payload)}` }
}

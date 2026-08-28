import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['ownerScopeRef', 'repositoryRevisionRef', 'target', 'change'])
const TARGET_KEYS = new Set(['path', 'exists', 'contentDigest'])
const CHANGE_KEYS = new Set(['operation', 'baseContentDigest', 'content', 'reason', 'sourceRefs', 'evidenceRefs'])
const DIGEST = /^sha256:[0-9a-f]{64}$/
const KNOWLEDGE_PATH = /^knowledge\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.md$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function assertObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !keys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function assertRef(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeRefs(values, name) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) throw new Error(`${name} must contain 1..20 references`)
  const normalized = values.map((value, index) => assertRef(value, `${name}[${index}]`))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
  return normalized.sort()
}

function normalizeDigest(value, name, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(`${name} must be a sha256 digest`)
  return value
}

export function normalizeDurableMemoryChangeInput(input) {
  assertObject(input, 'input', INPUT_KEYS)
  assertObject(input.target, 'target', TARGET_KEYS)
  assertObject(input.change, 'change', CHANGE_KEYS)
  const targetPath = String(input.target.path || '')
  if (targetPath !== 'USER.md' && !KNOWLEDGE_PATH.test(targetPath)) throw new Error('target.path must be USER.md or one Markdown file directly inside knowledge/')
  if (typeof input.target.exists !== 'boolean') throw new Error('target.exists must be boolean')
  const currentDigest = normalizeDigest(input.target.contentDigest, 'target.contentDigest', true)
  if (input.target.exists !== (currentDigest !== null)) throw new Error('target.exists and target.contentDigest are inconsistent')
  const operation = input.change.operation
  if (!['upsert', 'delete'].includes(operation)) throw new Error('change.operation must be upsert or delete')
  const baseContentDigest = normalizeDigest(input.change.baseContentDigest, 'change.baseContentDigest', true)
  let content = null
  if (operation === 'upsert') {
    if (typeof input.change.content !== 'string') throw new Error('upsert content must be Markdown text')
    content = input.change.content.replaceAll('\0', '').trim()
    if (!content) throw new Error('upsert content must not be empty')
    content += '\n'
    const maximum = targetPath === 'USER.md' ? 2000 : 50_000
    if ([...content].length > maximum) throw new Error(`${targetPath} exceeds the ${maximum} character review budget`)
  } else if (input.change.content !== null) {
    throw new Error('delete content must be null')
  }
  const reason = String(input.change.reason || '').trim()
  if (!reason || reason.length > 1000) throw new Error('change.reason must contain 1..1000 characters')
  return {
    ownerScopeRef: assertRef(input.ownerScopeRef, 'ownerScopeRef'),
    repositoryRevisionRef: assertRef(input.repositoryRevisionRef, 'repositoryRevisionRef'),
    target: { path: targetPath, exists: input.target.exists, contentDigest: currentDigest },
    change: {
      operation,
      baseContentDigest,
      content,
      reason,
      sourceRefs: normalizeRefs(input.change.sourceRefs, 'change.sourceRefs'),
      evidenceRefs: normalizeRefs(input.change.evidenceRefs, 'change.evidenceRefs'),
    },
  }
}

function reviewItems() {
  return [
    'exact-target-and-content',
    'durable-after-current-task',
    'source-and-provenance',
    'sensitive-data-and-secrets',
    'unsupported-inference',
    'conflict-and-supersession',
    'forget-scope-and-consequences',
  ].map((id) => ({ id, status: 'pending' }))
}

export function prepareDurableMemoryChangeReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeDurableMemoryChangeInput(input)
  const desiredContentDigest = normalized.change.operation === 'upsert' ? digestText(normalized.change.content) : null
  const current = normalized.target.contentDigest
  const base = normalized.change.baseContentDigest
  const alreadySatisfied = current === desiredContentDigest
  const stale = !alreadySatisfied && current !== base
  const blockers = stale ? [{ code: 'target-changed-after-proposal', expectedBaseContentDigest: base, currentContentDigest: current }] : []
  const status = alreadySatisfied ? 'already-satisfied' : stale ? 'blocked' : 'ready-for-human-review'
  const revisionPayload = {
    schemaVersion: 'dsh.durable-memory-change-review-revision/v1',
    ownerScopeRef: normalized.ownerScopeRef,
    repositoryRevisionRef: normalized.repositoryRevisionRef,
    target: normalized.target,
    change: { ...normalized.change, desiredContentDigest },
    implementationSemanticsRevision: 'dsh-personal-knowledge-base@c8e181adcf3904f47fd33b85ffc1e97126cbbd66',
  }
  return {
    ...revisionPayload,
    status,
    reviewRevisionHash: status === 'ready-for-human-review' ? digestText(stableStringify(revisionPayload)) : null,
    reviewItems: status === 'ready-for-human-review' ? reviewItems() : [],
    preflight: { blockers },
    reviewerDecision: null,
    proposalCreated: false,
    applied: false,
    committed: false,
    receiptIssued: false,
    executionAuthorized: false,
    preparedAt: now().toISOString(),
  }
}

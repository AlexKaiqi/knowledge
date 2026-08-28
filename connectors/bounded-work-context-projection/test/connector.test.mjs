import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { readBoundedWorkContext } from '../src/index.mjs'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const input = {
  query: 'projection',
  currentSessionRef: 'session:current-1',
  workspaceRef: 'workspace:primary',
  maxChars: 2400,
  includePriorSessions: true,
}

function provider(overrides = {}) {
  const text = overrides.text ?? '# Work Context Projection\n\n## Current work\n\nKeep the active task bounded.\n'
  return async ({ query, currentSessionId }) => ({
    query,
    sessionId: currentSessionId,
    cwd: '/private/workspace/path',
    revision: 'abc123',
    hash: sha256(text),
    chars: text.length,
    sources: ['.pkb/current.md', 'session:prior-1', 'knowledge/projection.md'],
    text,
    ...overrides,
  })
}

test('returns an ephemeral bounded projection while hiding provider paths and revisions', async () => {
  const result = await readBoundedWorkContext(input, { projectContext: provider() })
  assert.equal(result.coverage.currentWorkIncluded, true)
  assert.equal(result.coverage.currentSessionTranscriptIncluded, false)
  assert.equal(result.coverage.priorSessionCount, 1)
  assert.equal(result.coverage.durableKnowledgeCount, 1)
  assert.equal(result.retention, 'ephemeral-only')
  assert.equal(result.executionAuthorized, false)
  assert.equal(JSON.stringify(result).includes('/private/workspace/path'), false)
  assert.equal(JSON.stringify(result).includes('abc123'), false)
})

test('passes only bounded opaque routing input to the provider', async () => {
  let observed
  await readBoundedWorkContext(input, { projectContext: async (options) => {
    observed = options
    return provider()({ query: options.query, currentSessionId: options.currentSessionId })
  } })
  assert.deepEqual(observed, {
    query: 'projection',
    currentSessionId: 'current-1',
    currentSessionRef: 'session:current-1',
    workspaceRef: 'workspace:primary',
    maxChars: 2272,
    includePriorSessions: true,
  })
})

test('fails closed on current-session echo, unsafe sources, hidden fields and budget drift', async () => {
  await assert.rejects(readBoundedWorkContext(input, { projectContext: provider({ sources: ['.pkb/current.md', 'session:current-1'] }) }), /current Session/)
  await assert.rejects(readBoundedWorkContext(input, { projectContext: provider({ sources: ['.pkb/current.md', '/private/transcript.jsonl'] }) }), /permitted logical source/)
  await assert.rejects(readBoundedWorkContext(input, { projectContext: provider({ transcript: 'private' }) }), /unsupported fields/)
  const oversized = '# Work Context Projection\n' + 'x'.repeat(2400)
  await assert.rejects(readBoundedWorkContext(input, { projectContext: provider({ text: oversized, chars: oversized.length, hash: sha256(oversized) }) }), /exceeds the public character budget/)
})

test('rejects prior-session sources when the caller disables them', async () => {
  await assert.rejects(readBoundedWorkContext({ ...input, includePriorSessions: false }, { projectContext: provider() }), /prior Sessions while disabled/)
})

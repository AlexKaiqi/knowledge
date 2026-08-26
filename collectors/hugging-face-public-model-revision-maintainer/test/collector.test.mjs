import assert from 'node:assert/strict'
import test from 'node:test'
import { HuggingFacePublicModelRevisionError } from '../../../connectors/hugging-face-public-model-revision/src/index.mjs'
import { collectHuggingFacePublicModelRevisionMaintenance } from '../src/index.mjs'

const stableResult = {
  modelRevision: {
    repoId: 'openai-community/gpt2',
    commitSha: '607a30d783dfa663caf39e06633721c8d4cfcd7e',
    visibility: 'public',
    gated: false,
    disabled: false,
    pipelineTag: 'text-generation',
    libraryName: 'transformers',
    tags: ['license:mit', 'text-generation', 'transformers'],
    manifestComplete: true,
    fileCount: 26,
    totalSizeBytes: 5632417295,
    fileManifestDigest: '4'.repeat(64),
  },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when semantic manifest and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectHuggingFacePublicModelRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when exact-commit classification or manifest changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, modelRevision: { ...stableResult.modelRevision, fileManifestDigest: 'f'.repeat(64), tags: ['changed'] } }
  const result = await collectHuggingFacePublicModelRevisionMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'review-hugging-face-model-revision-change')
})

test('requests a new probe when verification expires', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-08-26T00:00:00Z' } }
  const result = await collectHuggingFacePublicModelRevisionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.proposals.some((proposal) => proposal.action === 'rerun-live-probe'), true)
})

test('separates removal, policy deferral, and implementation failure without retrying', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  for (const [code, status] of [['not-found', 'review-required'], ['rate-limited', 'deferred'], ['access-policy-blocked', 'deferred']]) {
    let calls = 0
    const result = await collectHuggingFacePublicModelRevisionMaintenance({
      reader: async () => { calls += 1; throw new HuggingFacePublicModelRevisionError(code, { code, retryAt: '2026-08-27T00:02:00.000Z' }) },
      acceptedState,
    })
    assert.equal(result.status, status)
    assert.equal(calls, 1)
  }
  const failed = await collectHuggingFacePublicModelRevisionMaintenance({ reader: async () => { throw new Error('shape drift') }, acceptedState })
  assert.equal(failed.status, 'unreachable')
  assert.equal(failed.proposals[0].action, 'restore-hugging-face-model-revision-access')
})

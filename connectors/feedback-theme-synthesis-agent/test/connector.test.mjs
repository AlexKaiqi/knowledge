import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeedbackThemePrompt, normalizeFeedbackThemeEvidence, normalizeFeedbackThemeInput, synthesizeFeedbackThemeEvidence } from '../src/index.mjs'

const input = {
  question: 'Which workflow problem should the next revision address?',
  decision: 'Choose one bounded product experiment.',
  targetRef: 'release:demo-v1',
  sample: { observedFrom: '2026-08-20T00:00:00Z', observedTo: '2026-08-27T00:00:00Z', completeness: 'partial', sourceRefs: ['source:owned-comments'] },
  evidence: [
    { evidenceRef: 'feedback:1', kind: 'problem', statement: 'Setup loses the selected device after restart.', contentDigest: `sha256:${'a'.repeat(64)}`, observedAt: '2026-08-21T00:00:00Z', targetRevisionRef: 'revision:v1' },
    { evidenceRef: 'feedback:2', kind: 'workaround', statement: 'The device must be selected again on every launch.', contentDigest: `sha256:${'b'.repeat(64)}`, observedAt: '2026-08-22T00:00:00Z', targetRevisionRef: 'revision:v1' },
    { evidenceRef: 'feedback:3', kind: 'counterexample', statement: 'Device selection persisted after restart in this environment.', contentDigest: `sha256:${'c'.repeat(64)}`, observedAt: '2026-08-23T00:00:00Z', targetRevisionRef: 'revision:v1' },
    { evidenceRef: 'feedback:4', kind: 'request', statement: 'Add more avatar colors.', contentDigest: `sha256:${'d'.repeat(64)}`, observedAt: '2026-08-24T00:00:00Z', targetRevisionRef: 'revision:v1' },
  ],
  maxThemes: 3,
}

const candidate = {
  answer: 'Test whether persisting device selection removes repeated setup.',
  themes: [{ id: 'device-selection-persistence', label: 'Device selection persistence', problemStatement: 'Some users must repeat device setup after restarting.', workflow: 'Select a device, restart, and continue the prior task.', supportEvidenceRefs: ['feedback:2', 'feedback:1'], counterEvidenceRefs: ['feedback:3'], confidence: 'medium' }],
  conflicts: [{ statement: 'Persistence behavior differs across observed environments.', evidenceRefs: ['feedback:1', 'feedback:3'], treatment: 'Keep the environment dependency unresolved and test multiple configurations.' }],
  gaps: ['The sample does not identify which environment property explains the difference.'],
  counterSearch: { performed: true, evidenceRefs: ['feedback:3'], outcome: 'One contrary observation was found.' },
  nextProbes: [{ hypothesis: 'Persisting a stable device ref removes repeated setup.', method: 'Replay restart fixtures across three device configurations.', success: 'The selected device is restored in all supported fixtures.', failure: 'Any supported fixture loses or misbinds the selected device.' }],
}

test('normalizes bounded deidentified evidence and rejects route or identity fields', () => {
  const result = normalizeFeedbackThemeInput(input)
  assert.equal(result.evidence.length, 4)
  assert.throws(() => normalizeFeedbackThemeInput({ ...input, connectorId: 'hidden' }), /unsupported fields/)
  assert.throws(() => normalizeFeedbackThemeInput({ ...input, evidence: [{ ...input.evidence[0], username: 'person' }, ...input.evidence.slice(1)] }), /unsupported fields/)
})

test('derives sample-only counts, revision refs and unassigned evidence instead of trusting the agent', () => {
  const result = normalizeFeedbackThemeEvidence(candidate, { input, now: () => new Date('2026-08-27T03:30:00Z') })
  assert.deepEqual(result.themes[0].frequency, { supportingEvidenceCount: 2, consideredEvidenceCount: 4, interpretation: 'sample-only' })
  assert.deepEqual(result.themes[0].affectedRevisionRefs, ['revision:v1'])
  assert.deepEqual(result.unassignedEvidenceRefs, ['feedback:4'])
  assert.equal(result.humanReviewRequired, true)
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.conformance.status, 'passed')
})

test('rejects invented evidence, missing counter-search, too many themes and hidden result fields', () => {
  assert.throws(() => normalizeFeedbackThemeEvidence({ ...candidate, themes: [{ ...candidate.themes[0], supportEvidenceRefs: ['feedback:invented'] }] }, { input }), /unknown evidence/)
  assert.throws(() => normalizeFeedbackThemeEvidence({ ...candidate, counterSearch: { performed: false, evidenceRefs: [], outcome: 'none' } }, { input }), /must be performed/)
  assert.throws(() => normalizeFeedbackThemeEvidence({ ...candidate, themes: Array(4).fill(candidate.themes[0]) }, { input }), /bounds/)
  assert.throws(() => normalizeFeedbackThemeEvidence({ ...candidate, internalTrace: 'hidden' }, { input }), /non-public fields/)
})

test('agentic handler receives a bounded contract and returns a review-only result', async () => {
  const result = await synthesizeFeedbackThemeEvidence(input, {
    now: () => new Date('2026-08-27T03:30:00Z'),
    runAgent: async ({ prompt, outputSchemaRef }) => {
      assert.match(prompt, /sample only/)
      assert.match(buildFeedbackThemePrompt(input), /must not reply to users/)
      assert.equal(outputSchemaRef, '/schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json')
      return candidate
    },
  })
  assert.equal(result.executionAuthorized, false)
})

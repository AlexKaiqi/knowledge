import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCENARIO_STRATEGIES,
  buildResearchPrompt,
  conductEvidenceBackedResearch,
  normalizeResearchDossier,
  normalizeResearchInput,
} from '../src/index.mjs'

const input = {
  scenario: 'technical-solution',
  goal: 'Make research reusable as a capability',
  decision: 'Choose an upstream method to adapt',
  questions: ['Which method is the best base?'],
  constraints: { cutoffAt: '2026-08-27T00:00:00Z', versions: ['pinned commits'] },
  budget: { maxSources: 8, maxQueries: 6 },
}

const evidence = [
  { id: 'general-method', role: 'implementation-evidence' },
  { id: 'evaluation-contract', role: 'benchmark' },
  { id: 'opposing-method', role: 'counter-evidence' },
]

const candidate = {
  scenario: 'technical-solution',
  question: 'Which upstream method should be adapted?',
  decision: input.decision,
  answer: 'Adapt the general method and add scenario-specific evidence contracts.',
  confidence: 'medium',
  findings: [
    { id: 'base-method', claim: 'The general method covers cross-source synthesis.', status: 'supported', confidence: 'high', evidenceIds: ['general-method'], counterEvidenceIds: ['opposing-method'], applicability: 'General multi-source research', inference: false },
  ],
  evidence,
  conflicts: [],
  gaps: ['No runtime-wide L3 evaluation yet.'],
  counterEvidenceSearch: { performed: true, queries: ['research method specialized alternative'], outcome: 'found', evidenceIds: ['opposing-method'] },
  nextProbes: [{ hypothesis: 'One contract can preserve scenario-specific rigor.', method: 'Run one case for every scenario.', success: 'All cases preserve required evidence roles.', failure: 'Any scenario loses its unique evidence boundary.', effect: 'none' }],
  coverage: { queryCount: 3, stoppedBecause: 'decision-sufficient', complete: true },
}

test('all supported research scenarios have distinct evidence strategies', () => {
  assert.deepEqual(Object.keys(SCENARIO_STRATEGIES).sort(), [
    'academic-frontier',
    'demand',
    'distribution-impact',
    'market-competitive',
    'platform-integration',
    'technical-solution',
  ])
  assert.equal(new Set(Object.values(SCENARIO_STRATEGIES).map((strategy) => strategy.method)).size, 6)
})

test('input normalization rejects route and prompt leakage', () => {
  assert.throws(() => normalizeResearchInput({ ...input, connectorId: 'hidden' }), /unknown input fields/)
  assert.match(buildResearchPrompt(input), /Required evidence roles: implementation-evidence, benchmark, counter-evidence/)
})

test('dossier conformance requires traceability, counter-search and scenario roles', () => {
  const result = normalizeResearchDossier(candidate, { input, now: () => new Date('2026-08-27T00:43:05Z') })
  assert.equal(result.conformance.status, 'passed')
  assert.deepEqual(result.coverage.requiredRoles, ['implementation-evidence', 'benchmark', 'counter-evidence'])
  assert.equal(result.coverage.sourceCount, 3)
  assert.match(result.resultDigest, /^[a-f0-9]{64}$/)

  const incomplete = normalizeResearchDossier({ ...candidate, evidence: evidence.slice(0, 2) }, { input, now: () => new Date('2026-08-27T00:43:05Z') })
  assert.equal(incomplete.conformance.status, 'review-required')
  assert.throws(() => normalizeResearchDossier({ ...candidate, connectorId: 'hidden-route' }, { input, now: () => new Date('2026-08-27T00:43:05Z') }), /non-public fields/)
})

test('agentic handler injects the bounded prompt and normalizes its result', async () => {
  const result = await conductEvidenceBackedResearch(input, {
    now: () => new Date('2026-08-27T00:43:05Z'),
    runAgent: async ({ prompt, outputSchemaRef }) => {
      assert.match(prompt, /Open every cited source/)
      assert.equal(outputSchemaRef, '/schemas/research/conduct-evidence-backed-research-output.schema.json')
      return candidate
    },
  })
  assert.equal(result.conformance.status, 'passed')
})

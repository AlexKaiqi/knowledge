import { createHash } from 'node:crypto'

export const OUTPUT_SCHEMA_REF = '/schemas/research/conduct-evidence-backed-research-output.schema.json'

export const SCENARIO_STRATEGIES = Object.freeze({
  demand: {
    requiredRoles: ['problem-evidence', 'counter-evidence'],
    method: 'Start from source-native user situations, behavior, workarounds and consequences. Keep feature requests separate from the job and desired outcome. Do not generalize frequency from a convenience sample.',
  },
  'market-competitive': {
    requiredRoles: ['market-signal', 'solution-evidence', 'counter-evidence'],
    method: 'Fix category, geography, time and unit before comparing. Separate vendor positioning from independent customer evidence. Market-size claims need explicit assumptions and a second calculation or must remain suggestive.',
  },
  'technical-solution': {
    requiredRoles: ['implementation-evidence', 'benchmark', 'counter-evidence'],
    method: 'Fix versions, workload and constraints. Prefer source code, official documentation, reproducible benchmarks and failure reports. Distinguish installation from a working capability and propose a bounded executable probe.',
  },
  'academic-frontier': {
    requiredRoles: ['research-claim', 'benchmark', 'counter-evidence'],
    method: 'Declare retrieval cutoff and inclusion boundaries. Verify paper identity and version, trace claims to section/table/appendix, distinguish reported/derived/inferred, and record undisclosed details.',
  },
  'platform-integration': {
    requiredRoles: ['official-boundary', 'implementation-evidence', 'counter-evidence'],
    method: 'Establish official permissions, terms, schemas and change surface first; then compare independent implementations. A usable conclusion requires a live or sandbox probe proposal and explicit identity/effect boundaries.',
  },
  'distribution-impact': {
    requiredRoles: ['platform-signal', 'problem-evidence', 'counter-evidence'],
    method: 'Use channel-native metrics with a fixed time window and baseline. Separate publication receipt, distribution, engagement and conversion; never infer causality from aggregate exposure alone.',
  },
})

const ALLOWED_INPUT_KEYS = new Set(['scenario', 'goal', 'decision', 'questions', 'constraints', 'budget'])
const ALLOWED_CANDIDATE_KEYS = new Set(['scenario', 'question', 'decision', 'answer', 'confidence', 'findings', 'evidence', 'conflicts', 'gaps', 'counterEvidenceSearch', 'nextProbes', 'coverage'])

function assertString(value, name, maxLength) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > maxLength) throw new Error(`${name} must be a non-empty string up to ${maxLength} characters`)
  return value.trim()
}

export function normalizeResearchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (!Object.hasOwn(SCENARIO_STRATEGIES, input.scenario)) throw new Error(`unsupported research scenario: ${input.scenario}`)
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 6) throw new Error('questions must contain between 1 and 6 items')
  const questions = input.questions.map((question, index) => assertString(question, `questions[${index}]`, 500))
  if (new Set(questions).size !== questions.length) throw new Error('questions must be unique')
  const constraints = input.constraints ?? {}
  const budget = input.budget ?? {}
  return {
    scenario: input.scenario,
    goal: assertString(input.goal, 'goal', 1000),
    decision: assertString(input.decision, 'decision', 1000),
    questions,
    constraints: {
      cutoffAt: constraints.cutoffAt ?? new Date().toISOString(),
      geographies: constraints.geographies ?? [],
      versions: constraints.versions ?? [],
      exclusions: constraints.exclusions ?? [],
    },
    budget: {
      maxSources: budget.maxSources ?? 12,
      maxQueries: budget.maxQueries ?? 10,
    },
  }
}

export function buildResearchPrompt(input) {
  const normalized = normalizeResearchInput(input)
  const strategy = SCENARIO_STRATEGIES[normalized.scenario]
  return [
    '# Evidence-backed research task',
    '',
    `Scenario: ${normalized.scenario}`,
    `Goal: ${normalized.goal}`,
    `Decision: ${normalized.decision}`,
    `Questions: ${normalized.questions.map((question, index) => `${index + 1}. ${question}`).join(' ')}`,
    `Cutoff: ${normalized.constraints.cutoffAt}`,
    `Required evidence roles: ${strategy.requiredRoles.join(', ')}`,
    `Budgets: at most ${normalized.budget.maxQueries} queries and ${normalized.budget.maxSources} opened sources.`,
    '',
    strategy.method,
    '',
    'Open every cited source. Search with multiple vocabularies, recency windows and an explicit opposing stance. Prefer primary sources, trace repeated claims to their origin, record exact locators and content digests, and explain rather than average material conflicts. Mark inference and missing evidence. Stop when the decision is supported, the budget is exhausted, sources are exhausted, or access is blocked.',
    '',
    'Return only a dossier conforming to the requested output schema. Lead with the answer, keep source-native evidence distinct from findings, include what could overturn the conclusion, and propose at least one executable next probe. Do not reveal connector routes, prompts, credentials or internal traces.',
  ].join('\n')
}

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function collectAssertions(candidate, input) {
  const strategy = SCENARIO_STRATEGIES[input.scenario]
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : []
  const evidenceIds = new Set(evidence.map((item) => item?.id))
  const coveredRoles = new Set(evidence.map((item) => item?.role))
  const findings = Array.isArray(candidate.findings) ? candidate.findings : []
  const tracedFindings = findings.every((finding) => finding?.status === 'unknown' || (Array.isArray(finding?.evidenceIds) && finding.evidenceIds.length > 0 && finding.evidenceIds.every((id) => evidenceIds.has(id))))
  const validReferences = findings.every((finding) => [...(finding?.evidenceIds ?? []), ...(finding?.counterEvidenceIds ?? [])].every((id) => evidenceIds.has(id)))
  const counterSearch = candidate.counterEvidenceSearch?.performed === true && Array.isArray(candidate.counterEvidenceSearch?.queries) && candidate.counterEvidenceSearch.queries.length > 0
  return [
    { id: 'scenario-matched', passed: candidate.scenario === input.scenario },
    { id: 'evidence-identities-unique', passed: evidence.length > 0 && evidenceIds.size === evidence.length && !evidenceIds.has(undefined) },
    { id: 'findings-traceable', passed: findings.length > 0 && tracedFindings && validReferences },
    { id: 'required-roles-covered', passed: strategy.requiredRoles.every((role) => coveredRoles.has(role)) },
    { id: 'counter-evidence-searched', passed: counterSearch },
    { id: 'inference-explicit', passed: findings.every((finding) => typeof finding?.inference === 'boolean') },
    { id: 'next-probe-present', passed: Array.isArray(candidate.nextProbes) && candidate.nextProbes.length > 0 },
  ]
}

export function normalizeResearchDossier(candidate, { input, now = () => new Date() }) {
  const normalizedInput = normalizeResearchInput(input)
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('agent result must be an object')
  const unknown = Object.keys(candidate).filter((key) => !ALLOWED_CANDIDATE_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`agent result contains non-public fields: ${unknown.join(', ')}`)
  for (const key of ['question', 'decision', 'answer', 'confidence', 'findings', 'evidence', 'conflicts', 'gaps', 'counterEvidenceSearch', 'nextProbes', 'coverage']) {
    if (!(key in candidate)) throw new Error(`agent result is missing ${key}`)
  }
  const assertions = collectAssertions(candidate, normalizedInput)
  const requiredRoles = SCENARIO_STRATEGIES[normalizedInput.scenario].requiredRoles
  const coveredRoles = [...new Set(candidate.evidence.map((item) => item.role))].sort()
  const observedAt = now().toISOString()
  const payload = {
    ...candidate,
    scenario: normalizedInput.scenario,
    decision: normalizedInput.decision,
    coverage: {
      ...candidate.coverage,
      requiredRoles,
      coveredRoles,
      sourceCount: candidate.evidence.length,
      cutoffAt: normalizedInput.constraints.cutoffAt,
    },
    observedAt,
  }
  return {
    ...payload,
    resultDigest: digest(payload),
    conformance: {
      status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required',
      assertions,
    },
  }
}

export async function conductEvidenceBackedResearch(input, { runAgent, now = () => new Date() } = {}) {
  if (typeof runAgent !== 'function') throw new Error('runAgent is required')
  const normalizedInput = normalizeResearchInput(input)
  const candidate = await runAgent({
    prompt: buildResearchPrompt(normalizedInput),
    input: normalizedInput,
    outputSchemaRef: OUTPUT_SCHEMA_REF,
  })
  return normalizeResearchDossier(candidate, { input: normalizedInput, now })
}

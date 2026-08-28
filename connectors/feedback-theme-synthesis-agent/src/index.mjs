import { createHash } from 'node:crypto'

export const OUTPUT_SCHEMA_REF = '/schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json'
const INPUT_KEYS = new Set(['question', 'decision', 'targetRef', 'sample', 'evidence', 'maxThemes'])
const SAMPLE_KEYS = new Set(['observedFrom', 'observedTo', 'completeness', 'sourceRefs'])
const EVIDENCE_KEYS = new Set(['evidenceRef', 'kind', 'statement', 'contentDigest', 'observedAt', 'targetRevisionRef'])
const CANDIDATE_KEYS = new Set(['answer', 'themes', 'conflicts', 'gaps', 'counterSearch', 'nextProbes'])
const THEME_KEYS = new Set(['id', 'label', 'problemStatement', 'workflow', 'supportEvidenceRefs', 'counterEvidenceRefs', 'confidence'])
const EVIDENCE_KINDS = new Set(['problem', 'request', 'workaround', 'praise', 'context', 'counterexample'])
const CONFIDENCES = new Set(['low', 'medium', 'high'])
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DIGEST = /^sha256:[0-9a-f]{64}$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}
const digest = (value) => createHash('sha256').update(stableStringify(value)).digest('hex')

function text(value, name, max) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) throw new Error(`${name} must be a non-empty string up to ${max} characters`)
  return value.trim()
}

function opaque(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function date(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be RFC 3339`)
  return new Date(value).toISOString()
}

export function normalizeFeedbackThemeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  const sample = input.sample
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) throw new Error('sample must be an object')
  const unknownSample = Object.keys(sample).filter((key) => !SAMPLE_KEYS.has(key))
  if (unknownSample.length) throw new Error(`sample contains unsupported fields: ${unknownSample.join(', ')}`)
  if (!['partial', 'complete'].includes(sample.completeness)) throw new Error('sample.completeness is unsupported')
  const observedFrom = date(sample.observedFrom, 'sample.observedFrom')
  const observedTo = date(sample.observedTo, 'sample.observedTo')
  if (Date.parse(observedTo) < Date.parse(observedFrom)) throw new Error('sample.observedTo precedes observedFrom')
  if (!Array.isArray(sample.sourceRefs) || sample.sourceRefs.length < 1 || sample.sourceRefs.length > 20) throw new Error('sample.sourceRefs must contain 1..20 references')
  const sourceRefs = [...new Set(sample.sourceRefs.map((value, index) => opaque(value, `sample.sourceRefs[${index}]`)))].sort()
  if (!Array.isArray(input.evidence) || input.evidence.length < 2 || input.evidence.length > 100) throw new Error('evidence must contain 2..100 items')
  const evidence = input.evidence.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`evidence[${index}] must be an object`)
    const unknownItem = Object.keys(item).filter((key) => !EVIDENCE_KEYS.has(key))
    if (unknownItem.length) throw new Error(`evidence[${index}] contains unsupported fields: ${unknownItem.join(', ')}`)
    if (!EVIDENCE_KINDS.has(item.kind)) throw new Error(`evidence[${index}].kind is unsupported`)
    if (!DIGEST.test(item.contentDigest ?? '')) throw new Error(`evidence[${index}].contentDigest is invalid`)
    return {
      evidenceRef: opaque(item.evidenceRef, `evidence[${index}].evidenceRef`),
      kind: item.kind,
      statement: text(item.statement, `evidence[${index}].statement`, 1200),
      contentDigest: item.contentDigest,
      observedAt: date(item.observedAt, `evidence[${index}].observedAt`),
      ...(item.targetRevisionRef === undefined ? {} : { targetRevisionRef: opaque(item.targetRevisionRef, `evidence[${index}].targetRevisionRef`) }),
    }
  }).sort((left, right) => left.evidenceRef.localeCompare(right.evidenceRef))
  if (new Set(evidence.map((item) => item.evidenceRef)).size !== evidence.length) throw new Error('evidenceRef values must be unique')
  const maxThemes = input.maxThemes ?? 8
  if (!Number.isInteger(maxThemes) || maxThemes < 1 || maxThemes > 12) throw new Error('maxThemes must be between 1 and 12')
  return {
    question: text(input.question, 'question', 1000),
    decision: text(input.decision, 'decision', 1000),
    targetRef: opaque(input.targetRef, 'targetRef'),
    sample: { observedFrom, observedTo, completeness: sample.completeness, sourceRefs },
    evidence,
    maxThemes,
  }
}

export function buildFeedbackThemePrompt(input) {
  const normalized = normalizeFeedbackThemeInput(input)
  return [
    '# Feedback theme evidence synthesis',
    '',
    `Question: ${normalized.question}`,
    `Decision: ${normalized.decision}`,
    `Target: ${normalized.targetRef}`,
    `Sample: ${normalized.evidence.length} authorized deidentified items, ${normalized.sample.observedFrom}..${normalized.sample.observedTo}, completeness=${normalized.sample.completeness}.`,
    `Return at most ${normalized.maxThemes} themes.`,
    '',
    'Group by underlying user workflow, problem, consequence and workaround rather than surface keywords or requested features. Every theme must cite supporting evidence refs and list counterevidence refs, even when empty. Preserve material conflicts, unassigned evidence and missing context. Treat counts as clues within this sample only; never estimate prevalence, market share or user population. Do not invent evidence, people, identities, quotes, causes or product commitments.',
    '',
    'Return only the candidate fields required by the output contract. The result is decision support requiring human review; it must not reply to users, create issues, change a roadmap, publish, or authorize execution.',
  ].join('\n')
}

function normalizeRefList(values, name, knownRefs, { min = 0 } = {}) {
  if (!Array.isArray(values) || values.length < min) throw new Error(`${name} must be an array with at least ${min} items`)
  const result = [...new Set(values.map((value, index) => opaque(value, `${name}[${index}]`)))].sort()
  if (result.some((value) => !knownRefs.has(value))) throw new Error(`${name} contains an unknown evidence reference`)
  return result
}

export function normalizeFeedbackThemeEvidence(candidate, { input, now = () => new Date() }) {
  const normalized = normalizeFeedbackThemeInput(input)
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('agent result must be an object')
  const unknown = Object.keys(candidate).filter((key) => !CANDIDATE_KEYS.has(key))
  if (unknown.length) throw new Error(`agent result contains non-public fields: ${unknown.join(', ')}`)
  for (const key of CANDIDATE_KEYS) if (!(key in candidate)) throw new Error(`agent result is missing ${key}`)
  if (!Array.isArray(candidate.themes) || candidate.themes.length < 1 || candidate.themes.length > normalized.maxThemes) throw new Error('agent themes exceed the declared bounds')
  const knownRefs = new Set(normalized.evidence.map((item) => item.evidenceRef))
  const themeIds = new Set()
  const usedRefs = new Set()
  const themes = candidate.themes.map((theme, index) => {
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error(`themes[${index}] must be an object`)
    const unknownTheme = Object.keys(theme).filter((key) => !THEME_KEYS.has(key))
    if (unknownTheme.length) throw new Error(`themes[${index}] contains unsupported fields: ${unknownTheme.join(', ')}`)
    if (!ID.test(theme.id ?? '') || themeIds.has(theme.id)) throw new Error('theme ids must be unique slugs')
    themeIds.add(theme.id)
    if (!CONFIDENCES.has(theme.confidence)) throw new Error(`themes[${index}].confidence is unsupported`)
    const supportEvidenceRefs = normalizeRefList(theme.supportEvidenceRefs, `themes[${index}].supportEvidenceRefs`, knownRefs, { min: 1 })
    const counterEvidenceRefs = normalizeRefList(theme.counterEvidenceRefs, `themes[${index}].counterEvidenceRefs`, knownRefs)
    for (const ref of [...supportEvidenceRefs, ...counterEvidenceRefs]) usedRefs.add(ref)
    const revisionRefs = [...new Set(normalized.evidence.filter((item) => supportEvidenceRefs.includes(item.evidenceRef) && item.targetRevisionRef).map((item) => item.targetRevisionRef))].sort()
    return {
      id: theme.id,
      label: text(theme.label, `themes[${index}].label`, 200),
      problemStatement: text(theme.problemStatement, `themes[${index}].problemStatement`, 1200),
      workflow: text(theme.workflow, `themes[${index}].workflow`, 800),
      supportEvidenceRefs,
      counterEvidenceRefs,
      affectedRevisionRefs: revisionRefs,
      confidence: theme.confidence,
      frequency: { supportingEvidenceCount: supportEvidenceRefs.length, consideredEvidenceCount: normalized.evidence.length, interpretation: 'sample-only' },
      inference: true,
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
  const conflicts = candidate.conflicts
  if (!Array.isArray(conflicts) || conflicts.length > 20) throw new Error('conflicts must contain at most 20 items')
  const normalizedConflicts = conflicts.map((item, index) => ({
    statement: text(item?.statement, `conflicts[${index}].statement`, 1000),
    evidenceRefs: normalizeRefList(item?.evidenceRefs, `conflicts[${index}].evidenceRefs`, knownRefs, { min: 2 }),
    treatment: text(item?.treatment, `conflicts[${index}].treatment`, 1000),
  }))
  if (!Array.isArray(candidate.gaps) || candidate.gaps.length > 20) throw new Error('gaps must contain at most 20 items')
  const gaps = candidate.gaps.map((item, index) => text(item, `gaps[${index}]`, 800))
  const counterSearch = candidate.counterSearch
  if (!counterSearch || counterSearch.performed !== true || !Array.isArray(counterSearch.evidenceRefs)) throw new Error('counterSearch must be performed')
  const normalizedCounterSearch = { performed: true, evidenceRefs: normalizeRefList(counterSearch.evidenceRefs, 'counterSearch.evidenceRefs', knownRefs), outcome: text(counterSearch.outcome, 'counterSearch.outcome', 800) }
  if (!Array.isArray(candidate.nextProbes) || candidate.nextProbes.length < 1 || candidate.nextProbes.length > 12) throw new Error('nextProbes must contain 1..12 items')
  const nextProbes = candidate.nextProbes.map((item, index) => ({ hypothesis: text(item?.hypothesis, `nextProbes[${index}].hypothesis`, 800), method: text(item?.method, `nextProbes[${index}].method`, 1200), success: text(item?.success, `nextProbes[${index}].success`, 800), failure: text(item?.failure, `nextProbes[${index}].failure`, 800), effect: 'none' }))
  const unassignedEvidenceRefs = [...knownRefs].filter((ref) => !usedRefs.has(ref)).sort()
  const assertions = [
    { id: 'themes-bounded', passed: themes.length <= normalized.maxThemes },
    { id: 'themes-traceable', passed: themes.every((theme) => theme.supportEvidenceRefs.length > 0) },
    { id: 'counter-search-performed', passed: normalizedCounterSearch.performed },
    { id: 'sample-frequency-only', passed: themes.every((theme) => theme.frequency.interpretation === 'sample-only') },
    { id: 'human-review-required', passed: true },
    { id: 'execution-not-authorized', passed: true },
  ]
  const payload = {
    schemaVersion: 'dsh.feedback-theme-evidence/v1',
    question: normalized.question,
    decision: normalized.decision,
    targetRef: normalized.targetRef,
    answer: text(candidate.answer, 'answer', 3000),
    themes,
    conflicts: normalizedConflicts,
    gaps,
    counterSearch: normalizedCounterSearch,
    unassignedEvidenceRefs,
    nextProbes,
    sample: { ...normalized.sample, consideredEvidenceCount: normalized.evidence.length },
    observedAt: now().toISOString(),
    humanReviewRequired: true,
    executionAuthorized: false,
  }
  return { ...payload, resultDigest: digest(payload), conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } }
}

export async function synthesizeFeedbackThemeEvidence(input, { runAgent, now = () => new Date() } = {}) {
  if (typeof runAgent !== 'function') throw new Error('runAgent is required')
  const normalized = normalizeFeedbackThemeInput(input)
  const candidate = await runAgent({ prompt: buildFeedbackThemePrompt(normalized), input: normalized, outputSchemaRef: OUTPUT_SCHEMA_REF })
  return normalizeFeedbackThemeEvidence(candidate, { input: normalized, now })
}

import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'buildRevisionRef', 'questionnaireRevisionRef', 'sections', 'declarations', 'aiDisclosure'])
const SECTION_KEYS = new Set(['section', 'expectedQuestionRefs', 'answers'])
const ANSWER_KEYS = new Set(['questionRef', 'response', 'evidenceRefs', 'contentRefs'])
const RESPONSE_KEYS = new Set(['kind', 'value'])
const DECLARATION_KEYS = new Set(['allUploadedAdultContentDisclosed', 'answersMatchCurrentBuildAndStorePage'])
const AI_KEYS = new Set(['mode', 'shippedContentRefs', 'runtimeContentRefs', 'rightsEvidenceRefs', 'guardrailEvidenceRefs'])
const SECTIONS = Object.freeze(['general-content', 'mature-content', 'generative-ai-content'])
const RESPONSE_KINDS = new Set(['boolean', 'single-choice', 'multi-choice', 'text'])
const AI_MODES = new Set(['none', 'pre-generated', 'live-generated', 'both'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function record(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
  return value
}

function ref(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500 || /[\0\r\n]/.test(value)) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function refs(values, name, { minimum = 0, maximum = 100 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} references`)
  const normalized = values.map((value, index) => ref(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} references must be unique`)
  return normalized
}

function text(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`)
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  if (normalized.length < 1 || normalized.length > 2000 || CONTROL_CHARACTERS.test(normalized)) throw new Error(`${name} must contain 1..2000 safe characters`)
  return normalized
}

function normalizeResponse(value, name) {
  record(value, name, RESPONSE_KEYS)
  if (!RESPONSE_KINDS.has(value.kind)) throw new Error(`${name}.kind is unsupported`)
  if (value.kind === 'boolean') {
    if (typeof value.value !== 'boolean') throw new Error(`${name}.value must be boolean`)
    return { kind: value.kind, value: value.value }
  }
  if (value.kind === 'single-choice') return { kind: value.kind, value: ref(value.value, `${name}.value`) }
  if (value.kind === 'multi-choice') return { kind: value.kind, value: refs(value.value, `${name}.value`, { minimum: 1, maximum: 30 }) }
  return { kind: value.kind, value: text(value.value, `${name}.value`) }
}

export function normalizeSteamContentSurveyInput(input) {
  record(input, 'input', INPUT_KEYS)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 3) throw new Error('sections must contain 1..3 items')
  const sections = input.sections.map((item, index) => {
    const name = `sections[${index}]`
    record(item, name, SECTION_KEYS)
    if (!SECTIONS.includes(item.section)) throw new Error(`${name}.section is unsupported`)
    const expectedQuestionRefs = refs(item.expectedQuestionRefs, `${name}.expectedQuestionRefs`, { minimum: 1, maximum: 100 })
    if (!Array.isArray(item.answers) || item.answers.length > 100) throw new Error(`${name}.answers must contain 0..100 items`)
    const answers = item.answers.map((answer, answerIndex) => {
      const answerName = `${name}.answers[${answerIndex}]`
      record(answer, answerName, ANSWER_KEYS)
      return {
        questionRef: ref(answer.questionRef, `${answerName}.questionRef`),
        response: normalizeResponse(answer.response, `${answerName}.response`),
        evidenceRefs: refs(answer.evidenceRefs, `${answerName}.evidenceRefs`, { minimum: 1, maximum: 20 }),
        contentRefs: refs(answer.contentRefs, `${answerName}.contentRefs`, { minimum: 1, maximum: 20 }),
      }
    }).sort((left, right) => left.questionRef.localeCompare(right.questionRef))
    return { section: item.section, expectedQuestionRefs, answers }
  }).sort((left, right) => SECTIONS.indexOf(left.section) - SECTIONS.indexOf(right.section))
  const declarations = record(input.declarations, 'declarations', DECLARATION_KEYS)
  if (typeof declarations.allUploadedAdultContentDisclosed !== 'boolean' || typeof declarations.answersMatchCurrentBuildAndStorePage !== 'boolean') throw new Error('declarations must be booleans')
  const ai = record(input.aiDisclosure, 'aiDisclosure', AI_KEYS)
  if (!AI_MODES.has(ai.mode)) throw new Error('aiDisclosure.mode is unsupported')
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: ref(input.sourceRevisionRef, 'sourceRevisionRef'),
    buildRevisionRef: ref(input.buildRevisionRef, 'buildRevisionRef'),
    questionnaireRevisionRef: ref(input.questionnaireRevisionRef, 'questionnaireRevisionRef'),
    sections,
    declarations: { ...declarations },
    aiDisclosure: {
      mode: ai.mode,
      shippedContentRefs: refs(ai.shippedContentRefs, 'aiDisclosure.shippedContentRefs', { maximum: 50 }),
      runtimeContentRefs: refs(ai.runtimeContentRefs, 'aiDisclosure.runtimeContentRefs', { maximum: 50 }),
      rightsEvidenceRefs: refs(ai.rightsEvidenceRefs, 'aiDisclosure.rightsEvidenceRefs', { maximum: 50 }),
      guardrailEvidenceRefs: refs(ai.guardrailEvidenceRefs, 'aiDisclosure.guardrailEvidenceRefs', { maximum: 50 }),
    },
  }
}

function manualReview() {
  return { required: true, checks: [
    { id: 'current-questionnaire-revision', status: 'pending' },
    { id: 'question-mapping-and-answer-truthfulness', status: 'pending' },
    { id: 'current-build-and-store-page-match', status: 'pending' },
    { id: 'mature-content-disclosure-complete', status: 'pending' },
    { id: 'generative-ai-classification-complete', status: 'pending' },
    { id: 'ai-rights-and-legality-evidence', status: 'pending' },
    { id: 'live-ai-guardrails-sufficient', status: 'pending' },
    { id: 'owned-target-and-submitter-authority', status: 'pending' },
  ] }
}

function base(normalized, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-content-survey-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    questionnaireRevisionRef: normalized.questionnaireRevisionRef,
    policyRevision: 'steam-content-survey-2026-08-27',
    manualReview: manualReview(),
    platformValidated: false,
    buildValidatedByConnector: false,
    submittedToSteamworks: false,
    ratingIssued: false,
    storefrontVisibilityChanged: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt,
  }
}

export function prepareSteamContentSurveyReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamContentSurveyInput(input)
  const blockers = []
  const sectionCounts = new Map()
  for (const section of normalized.sections) {
    sectionCounts.set(section.section, (sectionCounts.get(section.section) ?? 0) + 1)
    const expected = new Set(section.expectedQuestionRefs)
    const answerCounts = new Map()
    for (const answer of section.answers) answerCounts.set(answer.questionRef, (answerCounts.get(answer.questionRef) ?? 0) + 1)
    for (const questionRef of expected) if (!answerCounts.has(questionRef)) blockers.push({ code: 'missing-question-answer', section: section.section, questionRef })
    for (const [questionRef, count] of answerCounts) {
      if (!expected.has(questionRef)) blockers.push({ code: 'unexpected-question-answer', section: section.section, questionRef })
      if (count > 1) blockers.push({ code: 'duplicate-question-answer', section: section.section, questionRef })
    }
  }
  for (const section of SECTIONS) {
    const count = sectionCounts.get(section) ?? 0
    if (count === 0) blockers.push({ code: 'missing-required-section', section })
    if (count > 1) blockers.push({ code: 'duplicate-section', section })
  }
  if (!normalized.declarations.allUploadedAdultContentDisclosed) blockers.push({ code: 'adult-content-disclosure-unconfirmed' })
  if (!normalized.declarations.answersMatchCurrentBuildAndStorePage) blockers.push({ code: 'build-and-store-consistency-unconfirmed' })
  const ai = normalized.aiDisclosure
  const needsPre = ai.mode === 'pre-generated' || ai.mode === 'both'
  const needsLive = ai.mode === 'live-generated' || ai.mode === 'both'
  const requireAi = (condition, refsValue, detail) => { if (condition && refsValue.length === 0) blockers.push({ code: 'ai-evidence-incomplete', detail }) }
  requireAi(needsPre, ai.shippedContentRefs, 'shipped-content')
  requireAi(needsPre || needsLive, ai.rightsEvidenceRefs, 'rights-evidence')
  requireAi(needsLive, ai.runtimeContentRefs, 'runtime-content')
  requireAi(needsLive, ai.guardrailEvidenceRefs, 'guardrail-evidence')
  if (!needsPre && ai.shippedContentRefs.length > 0) blockers.push({ code: 'ai-mode-evidence-conflict', detail: 'unexpected-shipped-content' })
  if (!needsLive && (ai.runtimeContentRefs.length > 0 || ai.guardrailEvidenceRefs.length > 0)) blockers.push({ code: 'ai-mode-evidence-conflict', detail: 'unexpected-live-content-or-guardrails' })
  if (ai.mode === 'none' && ai.rightsEvidenceRefs.length > 0) blockers.push({ code: 'ai-mode-evidence-conflict', detail: 'unexpected-ai-rights-evidence' })
  blockers.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
  const checks = [
    { id: 'three-required-sections', status: blockers.some((item) => item.code === 'missing-required-section' || item.code === 'duplicate-section') ? 'failed' : 'passed' },
    { id: 'question-answer-set-closed', status: blockers.some((item) => item.code.includes('question-answer')) ? 'failed' : 'passed' },
    { id: 'adult-content-disclosure-declared', status: blockers.some((item) => item.code === 'adult-content-disclosure-unconfirmed') ? 'failed' : 'passed' },
    { id: 'build-and-store-consistency-declared', status: blockers.some((item) => item.code === 'build-and-store-consistency-unconfirmed') ? 'failed' : 'passed' },
    { id: 'generative-ai-evidence-shape', status: blockers.some((item) => item.code.startsWith('ai-')) ? 'failed' : 'passed' },
    { id: 'answer-evidence-and-content-bound', status: 'passed' },
  ]
  const common = base(normalized, now().toISOString())
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, sections: [], declarations: normalized.declarations, aiDisclosure: normalized.aiDisclosure, preflight: { checks, blockers } }
  const revisionPayload = {
    schemaVersion: common.schemaVersion, gameRef: normalized.gameRef, sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef, questionnaireRevisionRef: normalized.questionnaireRevisionRef,
    policyRevision: common.policyRevision, sections: normalized.sections, declarations: normalized.declarations, aiDisclosure: normalized.aiDisclosure,
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digestText(stableStringify(revisionPayload)), sections: normalized.sections, declarations: normalized.declarations, aiDisclosure: normalized.aiDisclosure, preflight: { checks, blockers: [] } }
}

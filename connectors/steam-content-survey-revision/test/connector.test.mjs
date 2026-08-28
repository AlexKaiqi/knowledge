import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSteamContentSurveyReviewRevision } from '../src/index.mjs'

const answer = (questionRef, response, suffix) => ({
  questionRef,
  response,
  evidenceRefs: [`evidence:${suffix}`],
  contentRefs: [`content:${suffix}`],
})

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'design:content-audit-v1',
  buildRevisionRef: 'build:steam-public-candidate-v7',
  questionnaireRevisionRef: 'steam-content-survey:observed-2026-08-27',
  sections: [
    {
      section: 'general-content',
      expectedQuestionRefs: ['survey-question:general-gambling', 'survey-question:general-violence'],
      answers: [
        answer('survey-question:general-gambling', { kind: 'boolean', value: false }, 'general-gambling'),
        answer('survey-question:general-violence', { kind: 'single-choice', value: 'choice:fantasy-violence-occasional' }, 'general-violence'),
      ],
    },
    {
      section: 'mature-content',
      expectedQuestionRefs: ['survey-question:mature-adult-sexual-content', 'survey-question:mature-language'],
      answers: [
        answer('survey-question:mature-adult-sexual-content', { kind: 'boolean', value: false }, 'mature-adult-sexual-content'),
        answer('survey-question:mature-language', { kind: 'single-choice', value: 'choice:mild' }, 'mature-language'),
      ],
    },
    {
      section: 'generative-ai-content',
      expectedQuestionRefs: ['survey-question:ai-live-generated', 'survey-question:ai-pre-generated'],
      answers: [
        answer('survey-question:ai-live-generated', { kind: 'boolean', value: true }, 'ai-live-generated'),
        answer('survey-question:ai-pre-generated', { kind: 'boolean', value: true }, 'ai-pre-generated'),
      ],
    },
  ],
  declarations: { allUploadedAdultContentDisclosed: true, answersMatchCurrentBuildAndStorePage: true },
  aiDisclosure: {
    mode: 'both',
    shippedContentRefs: ['content:ai-assisted-localization'],
    runtimeContentRefs: ['system:dynamic-npc-dialogue'],
    rightsEvidenceRefs: ['rights:ai-content-audit-v1'],
    guardrailEvidenceRefs: ['guardrail:runtime-generation-policy-v3'],
  },
}

test('freezes a complete content-survey answer set into a deterministic review revision', () => {
  const result = prepareSteamContentSurveyReviewRevision(input, { now: () => new Date('2026-08-27T00:00:00Z') })
  const replay = prepareSteamContentSurveyReviewRevision(input, { now: () => new Date('2026-08-28T00:00:00Z') })
  assert.equal(result.status, 'ready-for-human-review')
  assert.equal(result.revisionHash, replay.revisionHash)
  assert.deepEqual(result.sections.map((item) => item.section), ['general-content', 'mature-content', 'generative-ai-content'])
  assert.equal(result.manualReview.checks.every((item) => item.status === 'pending'), true)
  assert.equal(result.platformValidated || result.buildValidatedByConnector || result.submittedToSteamworks || result.ratingIssued || result.storefrontVisibilityChanged || result.markedReadyForReview || result.released || result.executionAuthorized, false)
})

test('binds questionnaire, build, answer, evidence, declaration and AI disclosure', () => {
  const base = prepareSteamContentSurveyReviewRevision(input).revisionHash
  const cases = [
    { ...input, buildRevisionRef: 'build:steam-public-candidate-v8' },
    { ...input, questionnaireRevisionRef: 'steam-content-survey:observed-next' },
  ]
  const response = structuredClone(input); response.sections[0].answers[0].response.value = true; cases.push(response)
  const evidence = structuredClone(input); evidence.sections[0].answers[0].evidenceRefs.push('evidence:second-audit'); cases.push(evidence)
  const declaration = structuredClone(input); declaration.declarations.answersMatchCurrentBuildAndStorePage = false; cases.push(declaration)
  const guardrail = structuredClone(input); guardrail.aiDisclosure.guardrailEvidenceRefs.push('guardrail:human-escalation-v1'); cases.push(guardrail)
  for (const candidate of cases) assert.notEqual(prepareSteamContentSurveyReviewRevision(candidate).revisionHash, base)
})

test('blocks incomplete question sets, missing sections and unconfirmed disclosures', () => {
  const missingAnswer = structuredClone(input); missingAnswer.sections[0].answers.pop()
  assert.equal(prepareSteamContentSurveyReviewRevision(missingAnswer).preflight.blockers.some((item) => item.code === 'missing-question-answer'), true)
  const unexpected = structuredClone(input); unexpected.sections[0].answers[0].questionRef = 'survey-question:unobserved'
  assert.equal(prepareSteamContentSurveyReviewRevision(unexpected).preflight.blockers.some((item) => item.code === 'unexpected-question-answer'), true)
  const missingSection = structuredClone(input); missingSection.sections.pop()
  assert.equal(prepareSteamContentSurveyReviewRevision(missingSection).preflight.blockers.some((item) => item.code === 'missing-required-section'), true)
  const adult = structuredClone(input); adult.declarations.allUploadedAdultContentDisclosed = false
  assert.equal(prepareSteamContentSurveyReviewRevision(adult).preflight.blockers.some((item) => item.code === 'adult-content-disclosure-unconfirmed'), true)
})

test('requires mode-specific AI evidence and rejects hidden authority', () => {
  const noGuardrails = structuredClone(input); noGuardrails.aiDisclosure.guardrailEvidenceRefs = []
  assert.equal(prepareSteamContentSurveyReviewRevision(noGuardrails).preflight.blockers.some((item) => item.detail === 'guardrail-evidence'), true)
  const noneWithAi = structuredClone(input); noneWithAi.aiDisclosure.mode = 'none'
  assert.equal(prepareSteamContentSurveyReviewRevision(noneWithAi).preflight.blockers.some((item) => item.code === 'ai-mode-evidence-conflict'), true)
  assert.throws(() => prepareSteamContentSurveyReviewRevision({ ...input, approved: true }), /unsupported fields/)
  const secret = structuredClone(input); secret.sections[0].answers[0].platformResponse = 'secret'
  assert.throws(() => prepareSteamContentSurveyReviewRevision(secret), /unsupported fields/)
})

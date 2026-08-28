import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'buildRevisionRef', 'questionnaireRevisionRef', 'answers', 'currentBuild', 'eligibility', 'pricePlan', 'thirdPartyDistribution'])
const ANSWER_KEYS = new Set(['questionRef', 'text', 'evidenceRefs'])
const BUILD_KEYS = new Set(['playabilityState', 'playableEvidenceRefs', 'gameplayTrailerEvidenceRefs', 'currentFeatureRefs', 'currentLimitationRefs'])
const ELIGIBILITY_KEYS = new Set(['developmentState', 'fundingDependency', 'futurePlanCommitment', 'communityInfluence'])
const PRICE_KEYS = new Set(['currentPriceRevisionRef', 'futurePriceDirection', 'steamPriceParity', 'transparencyEvidenceRefs', 'otherServiceAvailability', 'otherServicePriceEvidenceRefs'])
const THIRD_PARTY_KEYS = new Set(['mode', 'disclosureEvidenceRefs'])
const QUESTIONS = Object.freeze(['why-early-access', 'approximate-duration', 'planned-full-version-differences', 'current-early-access-state', 'pricing-during-and-after', 'community-involvement'])
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

function refs(values, name, { minimum = 0, maximum = 50 } = {}) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} references`)
  const normalized = values.map((value, index) => ref(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} references must be unique`)
  return normalized
}

function copy(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`)
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  if (normalized.length < 1 || normalized.length > 4000 || CONTROL_CHARACTERS.test(normalized)) throw new Error(`${name} must contain 1..4000 safe characters`)
  return normalized
}

function oneOf(value, name, allowed) {
  if (!allowed.includes(value)) throw new Error(`${name} is unsupported`)
  return value
}

export function normalizeSteamEarlyAccessInput(input) {
  record(input, 'input', INPUT_KEYS)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 6) throw new Error('answers must contain 1..6 items')
  const answers = input.answers.map((answer, index) => {
    const name = `answers[${index}]`
    record(answer, name, ANSWER_KEYS)
    return {
      questionRef: oneOf(answer.questionRef, `${name}.questionRef`, QUESTIONS),
      text: copy(answer.text, `${name}.text`),
      evidenceRefs: refs(answer.evidenceRefs, `${name}.evidenceRefs`, { minimum: 1, maximum: 20 }),
    }
  }).sort((left, right) => QUESTIONS.indexOf(left.questionRef) - QUESTIONS.indexOf(right.questionRef))
  const build = record(input.currentBuild, 'currentBuild', BUILD_KEYS)
  const eligibility = record(input.eligibility, 'eligibility', ELIGIBILITY_KEYS)
  const price = record(input.pricePlan, 'pricePlan', PRICE_KEYS)
  const thirdParty = record(input.thirdPartyDistribution, 'thirdPartyDistribution', THIRD_PARTY_KEYS)
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: ref(input.sourceRevisionRef, 'sourceRevisionRef'),
    buildRevisionRef: ref(input.buildRevisionRef, 'buildRevisionRef'),
    questionnaireRevisionRef: ref(input.questionnaireRevisionRef, 'questionnaireRevisionRef'),
    answers,
    currentBuild: {
      playabilityState: oneOf(build.playabilityState, 'currentBuild.playabilityState', ['playable-current-build', 'not-playable', 'unknown']),
      playableEvidenceRefs: refs(build.playableEvidenceRefs, 'currentBuild.playableEvidenceRefs', { minimum: 1 }),
      gameplayTrailerEvidenceRefs: refs(build.gameplayTrailerEvidenceRefs, 'currentBuild.gameplayTrailerEvidenceRefs', { minimum: 1 }),
      currentFeatureRefs: refs(build.currentFeatureRefs, 'currentBuild.currentFeatureRefs', { minimum: 1 }),
      currentLimitationRefs: refs(build.currentLimitationRefs, 'currentBuild.currentLimitationRefs'),
    },
    eligibility: {
      developmentState: oneOf(eligibility.developmentState, 'eligibility.developmentState', ['actively-in-development', 'finished-or-bugfix-only', 'unknown']),
      fundingDependency: oneOf(eligibility.fundingDependency, 'eligibility.fundingDependency', ['not-dependent-on-early-access-sales', 'dependent-on-early-access-sales', 'unknown']),
      futurePlanCommitment: oneOf(eligibility.futurePlanCommitment, 'eligibility.futurePlanCommitment', ['non-binding-and-changeable', 'specific-promises', 'unknown']),
      communityInfluence: oneOf(eligibility.communityInfluence, 'eligibility.communityInfluence', ['planned-and-material', 'not-planned', 'unknown']),
    },
    pricePlan: {
      currentPriceRevisionRef: ref(price.currentPriceRevisionRef, 'pricePlan.currentPriceRevisionRef'),
      futurePriceDirection: oneOf(price.futurePriceDirection, 'pricePlan.futurePriceDirection', ['lower', 'same', 'higher', 'undecided']),
      steamPriceParity: oneOf(price.steamPriceParity, 'pricePlan.steamPriceParity', ['confirmed-no-higher', 'higher-than-other-service', 'unknown']),
      transparencyEvidenceRefs: refs(price.transparencyEvidenceRefs, 'pricePlan.transparencyEvidenceRefs', { minimum: 1 }),
      otherServiceAvailability: oneOf(price.otherServiceAvailability, 'pricePlan.otherServiceAvailability', ['none', 'planned-or-active']),
      otherServicePriceEvidenceRefs: refs(price.otherServicePriceEvidenceRefs, 'pricePlan.otherServicePriceEvidenceRefs'),
    },
    thirdPartyDistribution: {
      mode: oneOf(thirdParty.mode, 'thirdPartyDistribution.mode', ['none', 'steam-key-sites']),
      disclosureEvidenceRefs: refs(thirdParty.disclosureEvidenceRefs, 'thirdPartyDistribution.disclosureEvidenceRefs'),
    },
  }
}

function manualReview() {
  return { required: true, checks: [
    { id: 'current-questionnaire-and-platform-fields', status: 'pending' },
    { id: 'answers-detailed-transparent-and-consistent', status: 'pending' },
    { id: 'current-build-is-playable-and-worth-current-price', status: 'pending' },
    { id: 'gameplay-trailer-represents-current-build', status: 'pending' },
    { id: 'current-state-and-limitations-match-build', status: 'pending' },
    { id: 'future-language-avoids-specific-promises', status: 'pending' },
    { id: 'funding-plan-does-not-rely-on-sales', status: 'pending' },
    { id: 'pricing-parity-and-transparency', status: 'pending' },
    { id: 'third-party-branding-and-disclosure', status: 'pending' },
    { id: 'community-involvement-is-material', status: 'pending' },
    { id: 'owned-target-and-submitter-authority', status: 'pending' },
  ] }
}

function base(normalized, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-early-access-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    questionnaireRevisionRef: normalized.questionnaireRevisionRef,
    policyRevision: 'steam-early-access-2026-08-27',
    manualReview: manualReview(),
    platformValidated: false,
    buildValidatedByConnector: false,
    priceValidated: false,
    savedToSteamworks: false,
    published: false,
    markedReadyForReview: false,
    releasedAsEarlyAccess: false,
    executionAuthorized: false,
    preparedAt,
  }
}

export function prepareSteamEarlyAccessReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamEarlyAccessInput(input)
  const blockers = []
  const counts = new Map()
  for (const answer of normalized.answers) counts.set(answer.questionRef, (counts.get(answer.questionRef) ?? 0) + 1)
  for (const questionRef of QUESTIONS) {
    const count = counts.get(questionRef) ?? 0
    if (count === 0) blockers.push({ code: 'missing-question-answer', questionRef })
    if (count > 1) blockers.push({ code: 'duplicate-question-answer', questionRef })
  }
  if (normalized.currentBuild.playabilityState === 'not-playable') blockers.push({ code: 'current-build-not-playable' })
  if (normalized.currentBuild.playabilityState === 'unknown') blockers.push({ code: 'current-build-playability-unknown' })
  const eligibility = normalized.eligibility
  if (eligibility.developmentState === 'finished-or-bugfix-only') blockers.push({ code: 'development-already-finished' })
  if (eligibility.developmentState === 'unknown') blockers.push({ code: 'development-state-unknown' })
  if (eligibility.fundingDependency === 'dependent-on-early-access-sales') blockers.push({ code: 'completion-depends-on-early-access-sales' })
  if (eligibility.fundingDependency === 'unknown') blockers.push({ code: 'funding-dependency-unknown' })
  if (eligibility.futurePlanCommitment === 'specific-promises') blockers.push({ code: 'specific-future-promises' })
  if (eligibility.futurePlanCommitment === 'unknown') blockers.push({ code: 'future-plan-commitment-unknown' })
  if (eligibility.communityInfluence === 'not-planned') blockers.push({ code: 'community-cannot-influence-development' })
  if (eligibility.communityInfluence === 'unknown') blockers.push({ code: 'community-influence-unknown' })
  const price = normalized.pricePlan
  if (price.steamPriceParity === 'higher-than-other-service') blockers.push({ code: 'steam-price-higher-than-other-service' })
  if (price.steamPriceParity === 'unknown') blockers.push({ code: 'steam-price-parity-unknown' })
  if (price.otherServiceAvailability === 'planned-or-active' && price.otherServicePriceEvidenceRefs.length === 0) blockers.push({ code: 'missing-other-service-price-evidence' })
  if (price.otherServiceAvailability === 'none' && price.otherServicePriceEvidenceRefs.length > 0) blockers.push({ code: 'unexpected-other-service-price-evidence' })
  const thirdParty = normalized.thirdPartyDistribution
  if (thirdParty.mode === 'steam-key-sites' && thirdParty.disclosureEvidenceRefs.length === 0) blockers.push({ code: 'missing-third-party-early-access-disclosure' })
  if (thirdParty.mode === 'none' && thirdParty.disclosureEvidenceRefs.length > 0) blockers.push({ code: 'unexpected-third-party-disclosure-evidence' })
  blockers.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
  const checks = [
    { id: 'six-question-answer-set', status: blockers.some((item) => item.code.includes('question-answer')) ? 'failed' : 'passed' },
    { id: 'current-build-playable-declared', status: blockers.some((item) => item.code.startsWith('current-build-')) ? 'failed' : 'passed' },
    { id: 'playability-and-trailer-evidence-bound', status: 'passed' },
    { id: 'future-plans-non-binding', status: blockers.some((item) => item.code.includes('future-plan') || item.code === 'specific-future-promises') ? 'failed' : 'passed' },
    { id: 'development-and-funding-eligible', status: blockers.some((item) => item.code.includes('development') || item.code.includes('funding') || item.code.includes('depends-on')) ? 'failed' : 'passed' },
    { id: 'community-influence-planned', status: blockers.some((item) => item.code.startsWith('community-')) ? 'failed' : 'passed' },
    { id: 'pricing-and-third-party-boundaries', status: blockers.some((item) => item.code.includes('price') || item.code.includes('third-party')) ? 'failed' : 'passed' },
  ]
  const common = base(normalized, now().toISOString())
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, answers: [], currentBuild: normalized.currentBuild, eligibility: normalized.eligibility, pricePlan: normalized.pricePlan, thirdPartyDistribution: normalized.thirdPartyDistribution, preflight: { checks, blockers } }
  const revisionPayload = {
    schemaVersion: common.schemaVersion,
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    questionnaireRevisionRef: normalized.questionnaireRevisionRef,
    policyRevision: common.policyRevision,
    answers: normalized.answers,
    currentBuild: normalized.currentBuild,
    eligibility: normalized.eligibility,
    pricePlan: normalized.pricePlan,
    thirdPartyDistribution: normalized.thirdPartyDistribution,
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digestText(stableStringify(revisionPayload)), answers: normalized.answers, currentBuild: normalized.currentBuild, eligibility: normalized.eligibility, pricePlan: normalized.pricePlan, thirdPartyDistribution: normalized.thirdPartyDistribution, preflight: { checks, blockers: [] } }
}

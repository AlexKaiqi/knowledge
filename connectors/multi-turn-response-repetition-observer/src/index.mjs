import { createHash } from 'node:crypto'

export const POLICY_REVISION = 'multi-turn-response-repetition-observation-2026-08-27'
export const NORMALIZATION_PROFILE = 'intl-word-segmentation-nfkc-lowercase-emoji-v1'
export const NGRAM_SIZES = Object.freeze([2, 3])

const INPUT_KEYS = new Set(['suiteRef', 'cases'])
const CASE_KEYS = new Set(['caseRef', 'locale', 'responses', 'repeatContexts'])
const RESPONSE_KEYS = new Set(['responseRef', 'text'])
const CONTEXT_KEYS = new Set(['currentResponseRef', 'priorResponseRef', 'kind', 'evidenceRefs'])
const CONTEXT_KINDS = new Set(['requested-repeat', 'confirmation-readback', 'repair-or-correction', 'safety-boundary', 'persona-catchphrase', 'other-reviewed-context'])
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const sha256 = (value) => `sha256:${createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex')}`

function record(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
  return value
}

function id(value, name) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${name} must be a lowercase slug`)
  return value
}

function opaque(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500 || /[\0\r\n]/.test(value)) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function text(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`)
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  if (normalized.length < 1 || normalized.length > 4000 || normalized.includes('\0')) throw new Error(`${name} must contain 1..4000 characters`)
  return normalized
}

function locale(value, name) {
  if (typeof value !== 'string' || value.length < 2 || value.length > 35 || /[\0\r\n]/.test(value)) throw new Error(`${name} must be a bounded BCP 47 locale`)
  try {
    const canonical = Intl.getCanonicalLocales(value)
    if (canonical.length !== 1) throw new Error()
    return canonical[0]
  } catch {
    throw new Error(`${name} must be a valid BCP 47 locale`)
  }
}

function normalizeCase(value, index) {
  const name = `cases[${index}]`
  record(value, name, CASE_KEYS)
  if (!Array.isArray(value.responses) || value.responses.length < 2 || value.responses.length > 20) throw new Error(`${name}.responses must contain 2..20 items`)
  const responses = value.responses.map((response, responseIndex) => {
    const responseName = `${name}.responses[${responseIndex}]`
    record(response, responseName, RESPONSE_KEYS)
    return { responseRef: id(response.responseRef, `${responseName}.responseRef`), text: text(response.text, `${responseName}.text`) }
  })
  const positions = new Map(responses.map((response, responseIndex) => [response.responseRef, responseIndex]))
  if (positions.size !== responses.length) throw new Error(`${name}.responseRef values must be unique`)
  if (!Array.isArray(value.repeatContexts) || value.repeatContexts.length > 40) throw new Error(`${name}.repeatContexts must contain 0..40 items`)
  const pairKeys = new Set()
  const repeatContexts = value.repeatContexts.map((context, contextIndex) => {
    const contextName = `${name}.repeatContexts[${contextIndex}]`
    record(context, contextName, CONTEXT_KEYS)
    const currentResponseRef = id(context.currentResponseRef, `${contextName}.currentResponseRef`)
    const priorResponseRef = id(context.priorResponseRef, `${contextName}.priorResponseRef`)
    if (!positions.has(currentResponseRef) || !positions.has(priorResponseRef)) throw new Error(`${contextName} references an unknown response`)
    if (positions.get(priorResponseRef) >= positions.get(currentResponseRef)) throw new Error(`${contextName}.priorResponseRef must precede currentResponseRef`)
    if (!CONTEXT_KINDS.has(context.kind)) throw new Error(`${contextName}.kind is unsupported`)
    if (!Array.isArray(context.evidenceRefs) || context.evidenceRefs.length < 1 || context.evidenceRefs.length > 10) throw new Error(`${contextName}.evidenceRefs must contain 1..10 items`)
    const evidenceRefs = context.evidenceRefs.map((item, evidenceIndex) => opaque(item, `${contextName}.evidenceRefs[${evidenceIndex}]`)).sort()
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${contextName}.evidenceRefs must be unique`)
    const pairKey = `${priorResponseRef}\0${currentResponseRef}`
    if (pairKeys.has(pairKey)) throw new Error(`${name}.repeatContexts must contain unique response pairs`)
    pairKeys.add(pairKey)
    return { currentResponseRef, priorResponseRef, kind: context.kind, evidenceRefs }
  }).sort((left, right) => positions.get(left.currentResponseRef) - positions.get(right.currentResponseRef) || positions.get(left.priorResponseRef) - positions.get(right.priorResponseRef))
  return { caseRef: id(value.caseRef, `${name}.caseRef`), locale: locale(value.locale, `${name}.locale`), responses, repeatContexts }
}

export function normalizeRepetitionInput(input) {
  record(input, 'input', INPUT_KEYS)
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 12) throw new Error('cases must contain 1..12 items')
  const cases = input.cases.map(normalizeCase).sort((left, right) => left.caseRef.localeCompare(right.caseRef))
  if (new Set(cases.map((item) => item.caseRef)).size !== cases.length) throw new Error('caseRef values must be unique')
  return { suiteRef: opaque(input.suiteRef, 'suiteRef'), cases }
}

function tokenize(value, localeValue) {
  const normalized = value.normalize('NFKC').toLocaleLowerCase(localeValue)
  const segmenter = new Intl.Segmenter(localeValue, { granularity: 'word' })
  const tokens = []
  for (const segment of segmenter.segment(normalized)) {
    if (segment.isWordLike || /\p{Extended_Pictographic}/u.test(segment.segment)) tokens.push(segment.segment)
  }
  return { tokens, normalized: tokens.length > 0 ? tokens.join('\u001f') : normalized.replace(/\s+/gu, ' ').trim() }
}

function ngrams(tokens, size) {
  const result = []
  for (let index = 0; index + size <= tokens.length; index += 1) result.push(tokens.slice(index, index + size).join('\u001f'))
  return result
}

function metric(current, priorSet, hasHistory) {
  if (current.length === 0) return { status: 'unavailable', total: 0, repeated: 0, fraction: null }
  if (!hasHistory) return { status: 'no-history', total: current.length, repeated: 0, fraction: null }
  const repeated = current.filter((item) => priorSet.has(item)).length
  return { status: 'observed', total: current.length, repeated, fraction: repeated / current.length }
}

function aggregateMetric(observations, field) {
  const metrics = observations.map((item) => item[field]).filter((item) => item.status === 'observed')
  const total = metrics.reduce((sum, item) => sum + item.total, 0)
  const repeated = metrics.reduce((sum, item) => sum + item.repeated, 0)
  return { comparableResponses: metrics.length, total, repeated, fraction: total === 0 ? null : repeated / total }
}

function buildCase(sourceCase) {
  const prepared = sourceCase.responses.map((response) => {
    const tokenized = tokenize(response.text, sourceCase.locale)
    return { ...response, ...tokenized, digest: sha256(response.text), bigrams: ngrams(tokenized.tokens, 2), trigrams: ngrams(tokenized.tokens, 3) }
  })
  const contextsByPair = new Map(sourceCase.repeatContexts.map((context) => [`${context.priorResponseRef}\0${context.currentResponseRef}`, context]))
  for (const context of sourceCase.repeatContexts) {
    const currentIndex = prepared.findIndex((item) => item.responseRef === context.currentResponseRef)
    const priorIndex = prepared.findIndex((item) => item.responseRef === context.priorResponseRef)
    const current = prepared[currentIndex]
    const prior = prepared[priorIndex]
    const lexicalOverlap = current.normalized === prior.normalized || current.bigrams.some((item) => new Set(prior.bigrams).has(item)) || current.trigrams.some((item) => new Set(prior.trigrams).has(item))
    if (!lexicalOverlap) throw new Error(`repeat context ${context.priorResponseRef}->${context.currentResponseRef} has no observed lexical repetition`)
  }
  const observations = prepared.map((current, index) => {
    const history = prepared.slice(0, index)
    const priorBigramSet = new Set(history.flatMap((item) => item.bigrams))
    const priorTrigramSet = new Set(history.flatMap((item) => item.trigrams))
    const exactPriorResponseRefs = history.filter((item) => item.normalized === current.normalized).map((item) => item.responseRef)
    const overlapPriorResponseRefs = history.filter((item) => item.bigrams.some((gram) => current.bigrams.includes(gram)) || item.trigrams.some((gram) => current.trigrams.includes(gram))).map((item) => item.responseRef)
    const repeatContexts = sourceCase.repeatContexts.filter((context) => context.currentResponseRef === current.responseRef)
    return {
      responseRef: current.responseRef,
      responseDigest: current.digest,
      tokenCount: current.tokens.length,
      historyResponseRefs: history.map((item) => item.responseRef),
      exactPriorResponseRefs,
      overlapPriorResponseRefs,
      repeatContexts,
      bigram: metric(current.bigrams, priorBigramSet, history.length > 0),
      trigram: metric(current.trigrams, priorTrigramSet, history.length > 0),
    }
  })
  const exactPairs = observations.flatMap((observation) => observation.exactPriorResponseRefs.map((priorResponseRef) => ({ priorResponseRef, currentResponseRef: observation.responseRef, contextualized: contextsByPair.has(`${priorResponseRef}\0${observation.responseRef}`) })))
  return {
    caseRef: sourceCase.caseRef,
    locale: sourceCase.locale,
    responseCount: observations.length,
    summary: {
      exactRepeatPairCount: exactPairs.length,
      contextualizedExactRepeatPairCount: exactPairs.filter((item) => item.contextualized).length,
      uncontextualizedExactRepeatPairCount: exactPairs.filter((item) => !item.contextualized).length,
      declaredRepeatContextPairCount: sourceCase.repeatContexts.length,
      bigram: aggregateMetric(observations, 'bigram'),
      trigram: aggregateMetric(observations, 'trigram'),
    },
    observations,
  }
}

export function observeMultiTurnResponseRepetition(input, { now = () => new Date() } = {}) {
  const normalized = normalizeRepetitionInput(input)
  const cases = normalized.cases.map(buildCase)
  const allObservations = cases.flatMap((item) => item.observations)
  const payload = {
    schemaVersion: 'dsh.multi-turn-response-repetition-observation/v1',
    suiteRef: normalized.suiteRef,
    policy: {
      revisionRef: POLICY_REVISION,
      normalizationProfile: NORMALIZATION_PROFILE,
      tokenizerRuntime: `node-intl-icu-${process.versions.icu}`,
      ngramSizes: [...NGRAM_SIZES],
      comparisonScope: 'prior-assistant-responses-in-supplied-case',
      thresholdsApplied: false,
    },
    summary: {
      caseCount: cases.length,
      responseCount: allObservations.length,
      exactRepeatPairCount: cases.reduce((sum, item) => sum + item.summary.exactRepeatPairCount, 0),
      contextualizedExactRepeatPairCount: cases.reduce((sum, item) => sum + item.summary.contextualizedExactRepeatPairCount, 0),
      uncontextualizedExactRepeatPairCount: cases.reduce((sum, item) => sum + item.summary.uncontextualizedExactRepeatPairCount, 0),
      declaredRepeatContextPairCount: cases.reduce((sum, item) => sum + item.summary.declaredRepeatContextPairCount, 0),
      bigram: aggregateMetric(allObservations, 'bigram'),
      trigram: aggregateMetric(allObservations, 'trigram'),
    },
    cases,
    interpretation: {
      declaredContextsAreCallerClaims: true,
      semanticRepetitionEvaluated: false,
      responseQualityInferred: false,
      personaContinuityInferred: false,
      companionshipOutcomeInferred: false,
      humanReviewRequired: true,
    },
    retention: 'input-text-ephemeral-output-digests-locators-and-lexical-counts-only',
    observedAt: now().toISOString(),
    personaChanged: false,
    memoryChanged: false,
    platformDataRead: false,
    actionExecuted: false,
    executionAuthorized: false,
  }
  const serialized = JSON.stringify(payload)
  const inputText = normalized.cases.flatMap((item) => item.responses.map((response) => response.text))
  const assertions = [
    { id: 'all-responses-observed', passed: allObservations.length === normalized.cases.reduce((sum, item) => sum + item.responses.length, 0) },
    { id: 'raw-repetition-preserved', passed: payload.summary.exactRepeatPairCount === payload.summary.contextualizedExactRepeatPairCount + payload.summary.uncontextualizedExactRepeatPairCount },
    { id: 'no-threshold-or-quality-score', passed: !payload.policy.thresholdsApplied && !Object.hasOwn(payload, 'score') },
    { id: 'declared-context-not-exemption', passed: payload.interpretation.declaredContextsAreCallerClaims },
    { id: 'semantic-and-outcome-boundary', passed: !payload.interpretation.semanticRepetitionEvaluated && !payload.interpretation.responseQualityInferred && !payload.interpretation.personaContinuityInferred && !payload.interpretation.companionshipOutcomeInferred },
    { id: 'input-text-not-retained', passed: inputText.every((value) => !serialized.includes(value)) },
    { id: 'no-effects-or-authorization', passed: !payload.personaChanged && !payload.memoryChanged && !payload.platformDataRead && !payload.actionExecuted && !payload.executionAuthorized },
  ]
  return { ...payload, resultDigest: sha256(payload), conformance: { status: assertions.every((item) => item.passed) ? 'passed' : 'review-required', assertions } }
}

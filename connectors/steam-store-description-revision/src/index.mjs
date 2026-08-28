import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'localizations', 'launchFeatureRefs', 'rightsBasisRefs'])
const LOCALIZATION_KEYS = new Set(['language', 'shortDescription', 'aboutThisGame', 'translationBasisRef'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const LANGUAGE_CODE = /^[a-z][a-z0-9-]{1,31}$/
const CURRENT_STORE_LANGUAGES = new Set([
  'arabic', 'brazilian', 'bulgarian', 'czech', 'danish', 'dutch', 'english', 'finnish', 'french', 'german', 'greek',
  'hungarian', 'indonesian', 'italian', 'japanese', 'koreana', 'latam', 'malay', 'norwegian', 'polish', 'portuguese',
  'romanian', 'russian', 'schinese', 'spanish', 'swedish', 'thai', 'tchinese', 'turkish', 'ukrainian', 'vietnamese',
])
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u
const HTML_OR_BBCODE = /<\/?[a-z][^>]*>|\[\/?(?:b|i|u|h[1-6]|list|quote|code|url|img|table|tr|td|th)(?:=[^\]]*)?\]/iu
const OBVIOUS_LINK = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|io|gg|co|cn|dev|app|ai)(?:\b|\/)|\bdot\s+(?:com|net|org|io|gg|co|cn|dev|app|ai)\b|点\s*(?:com|net|org|io|gg|co|cn|dev|app|ai)\b)/iu

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`
const codePointLength = (value) => [...value].length

function assertRef(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeText(value, name, maximum) {
  if (typeof value !== 'string' || value.length < 1 || codePointLength(value) > maximum) throw new Error(`${name} must contain 1..${maximum} code points`)
  if (value !== value.normalize('NFC')) throw new Error(`${name} must be NFC-normalized`)
  if (CONTROL_CHARACTERS.test(value)) throw new Error(`${name} contains unsupported control characters`)
  return value
}

export function normalizeSteamStoreDescriptionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.localizations) || input.localizations.length < 1 || input.localizations.length > 31) throw new Error('localizations must contain 1..31 items')
  const localizations = input.localizations.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`localizations[${index}] must be an object`)
    const extra = Object.keys(item).filter((key) => !LOCALIZATION_KEYS.has(key))
    if (extra.length > 0) throw new Error(`localizations[${index}] contains unsupported fields: ${extra.join(', ')}`)
    if (typeof item.language !== 'string' || !LANGUAGE_CODE.test(item.language)) throw new Error(`localizations[${index}].language is invalid`)
    return {
      language: item.language,
      shortDescription: normalizeText(item.shortDescription, `localizations[${index}].shortDescription`, 2000),
      aboutThisGame: normalizeText(item.aboutThisGame, `localizations[${index}].aboutThisGame`, 40000),
      translationBasisRef: assertRef(item.translationBasisRef, `localizations[${index}].translationBasisRef`),
    }
  }).sort((left, right) => left.language.localeCompare(right.language))
  if (new Set(localizations.map((item) => item.language)).size !== localizations.length) throw new Error('localization languages must be unique')
  const normalizeRefs = (values, name, maximum) => {
    if (!Array.isArray(values) || values.length < 1 || values.length > maximum) throw new Error(`${name} must contain 1..${maximum} references`)
    const normalized = values.map((value, index) => assertRef(value, `${name}[${index}]`))
    if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
    return normalized.sort()
  }
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: assertRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    localizations,
    launchFeatureRefs: normalizeRefs(input.launchFeatureRefs, 'launchFeatureRefs', 50),
    rightsBasisRefs: normalizeRefs(input.rightsBasisRefs, 'rightsBasisRefs', 20),
  }
}

function manualReview() {
  return {
    required: true,
    checks: [
      { id: 'unique-value-proposition-and-genre', status: 'pending' },
      { id: 'time-sensitive-copy', status: 'pending' },
      { id: 'detailed-and-coherent-description', status: 'pending' },
      { id: 'launch-feature-consistency', status: 'pending' },
      { id: 'other-product-and-implied-link-review', status: 'pending' },
      { id: 'translation-accuracy-and-fallback', status: 'pending' },
      { id: 'rights-and-claim-substantiation', status: 'pending' },
    ],
  }
}

function resultBase(input, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-store-description-review-revision/v1',
    gameRef: input.gameRef,
    sourceRevisionRef: input.sourceRevisionRef,
    launchFeatureRefs: input.launchFeatureRefs,
    rightsBasisRefs: input.rightsBasisRefs,
    policyRevision: 'steam-store-description-2026-08-27',
    manualReview: manualReview(),
    uploaded: false,
    published: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt,
  }
}

export function prepareSteamStoreDescriptionReviewRevision(input, {
  now = () => new Date(),
  maxLocalizations = 20,
  maxShortDescriptionCodePoints = 500,
  maxAboutThisGameCodePoints = 20000,
} = {}) {
  const normalized = normalizeSteamStoreDescriptionInput(input)
  for (const [name, value] of Object.entries({ maxLocalizations, maxShortDescriptionCodePoints, maxAboutThisGameCodePoints })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`)
  }
  const blockers = []
  const checks = [
    { id: 'english-fallback', status: 'passed' },
    { id: 'known-store-languages', status: 'passed' },
    { id: 'plain-text-short-description', status: 'passed' },
    { id: 'description-link-and-markup-boundary', status: 'passed' },
    { id: 'local-text-budgets', status: 'passed' },
  ]
  if (normalized.localizations.length > maxLocalizations) blockers.push({ code: 'localization-count-budget-exceeded', maximum: maxLocalizations, observed: normalized.localizations.length })
  if (!normalized.localizations.some((item) => item.language === 'english')) blockers.push({ code: 'english-fallback-required' })
  for (const item of normalized.localizations) {
    if (!CURRENT_STORE_LANGUAGES.has(item.language)) blockers.push({ code: 'unsupported-store-language', language: item.language })
    const shortLength = codePointLength(item.shortDescription)
    const aboutLength = codePointLength(item.aboutThisGame)
    if (shortLength > maxShortDescriptionCodePoints) blockers.push({ code: 'short-description-budget-exceeded', language: item.language, maximumCodePoints: maxShortDescriptionCodePoints, observedCodePoints: shortLength })
    if (aboutLength > maxAboutThisGameCodePoints) blockers.push({ code: 'about-this-game-budget-exceeded', language: item.language, maximumCodePoints: maxAboutThisGameCodePoints, observedCodePoints: aboutLength })
    if (/[\r\n\t]/u.test(item.shortDescription) || HTML_OR_BBCODE.test(item.shortDescription)) blockers.push({ code: 'short-description-must-be-plain-single-line', language: item.language })
    if (HTML_OR_BBCODE.test(item.aboutThisGame)) blockers.push({ code: 'about-this-game-markup-not-supported', language: item.language })
    if (OBVIOUS_LINK.test(item.shortDescription) || OBVIOUS_LINK.test(item.aboutThisGame)) blockers.push({ code: 'description-link-not-allowed', language: item.language })
  }
  for (const check of checks) {
    if (check.id === 'english-fallback' && blockers.some((item) => item.code === 'english-fallback-required')) check.status = 'failed'
    if (check.id === 'known-store-languages' && blockers.some((item) => item.code === 'unsupported-store-language')) check.status = 'failed'
    if (check.id === 'plain-text-short-description' && blockers.some((item) => item.code === 'short-description-must-be-plain-single-line')) check.status = 'failed'
    if (check.id === 'description-link-and-markup-boundary' && blockers.some((item) => ['about-this-game-markup-not-supported', 'description-link-not-allowed'].includes(item.code))) check.status = 'failed'
    if (check.id === 'local-text-budgets' && blockers.some((item) => item.code.includes('budget-exceeded'))) check.status = 'failed'
  }
  const base = resultBase(normalized, now().toISOString())
  if (blockers.length > 0) return { ...base, status: 'blocked', revisionHash: null, localizations: [], preflight: { checks, blockers } }
  const localizations = normalized.localizations.map((item) => ({
    ...item,
    shortDescriptionCodePoints: codePointLength(item.shortDescription),
    aboutThisGameCodePoints: codePointLength(item.aboutThisGame),
    shortDescriptionDigest: digestText(item.shortDescription),
    aboutThisGameDigest: digestText(item.aboutThisGame),
  }))
  const revisionPayload = {
    schemaVersion: base.schemaVersion,
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    localizations,
    launchFeatureRefs: normalized.launchFeatureRefs,
    rightsBasisRefs: normalized.rightsBasisRefs,
    policyRevision: base.policyRevision,
  }
  return { ...base, status: 'ready-for-human-review', revisionHash: digestText(stableStringify(revisionPayload)), localizations, preflight: { checks, blockers: [] } }
}

export { CURRENT_STORE_LANGUAGES }

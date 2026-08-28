import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'buildRevisionRef', 'featureCatalogRevisionRef', 'features'])
const FEATURE_KEYS = new Set(['featureRef', 'displayName', 'implementationState', 'implementationEvidenceRefs', 'testEvidenceRefs'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u
const IMPLEMENTATION_STATES = new Set(['implemented-current-build', 'planned-not-released', 'unknown'])

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function assertRef(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500 || /[\0\r\n]/.test(value)) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeRefs(values, name, maximum) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) throw new Error(`${name} must contain 1..${maximum} references`)
  const normalized = values.map((value, index) => assertRef(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} references must be unique`)
  return normalized
}

function normalizeDisplayName(value, name) {
  if (typeof value !== 'string' || value.trim() !== value || [...value].length < 1 || [...value].length > 100) throw new Error(`${name} must contain 1..100 trimmed code points`)
  if (value !== value.normalize('NFC')) throw new Error(`${name} must be NFC-normalized`)
  if (CONTROL_CHARACTERS.test(value)) throw new Error(`${name} contains unsupported control characters`)
  return value
}

export function normalizeSteamSupportedFeatureInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.features) || input.features.length < 1 || input.features.length > 30) throw new Error('features must contain 1..30 items')
  const features = input.features.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`features[${index}] must be an object`)
    const extra = Object.keys(item).filter((key) => !FEATURE_KEYS.has(key))
    if (extra.length > 0) throw new Error(`features[${index}] contains unsupported fields: ${extra.join(', ')}`)
    if (!IMPLEMENTATION_STATES.has(item.implementationState)) throw new Error(`features[${index}].implementationState is unsupported`)
    return {
      featureRef: assertRef(item.featureRef, `features[${index}].featureRef`),
      displayName: normalizeDisplayName(item.displayName, `features[${index}].displayName`),
      implementationState: item.implementationState,
      implementationEvidenceRefs: normalizeRefs(item.implementationEvidenceRefs, `features[${index}].implementationEvidenceRefs`, 20),
      testEvidenceRefs: normalizeRefs(item.testEvidenceRefs, `features[${index}].testEvidenceRefs`, 20),
    }
  }).sort((left, right) => left.featureRef.localeCompare(right.featureRef))
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: assertRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    buildRevisionRef: assertRef(input.buildRevisionRef, 'buildRevisionRef'),
    featureCatalogRevisionRef: assertRef(input.featureCatalogRevisionRef, 'featureCatalogRevisionRef'),
    features,
  }
}

function manualReview() {
  return {
    required: true,
    checks: [
      { id: 'current-platform-feature-availability', status: 'pending' },
      { id: 'feature-selection-matches-current-catalog', status: 'pending' },
      { id: 'implementation-evidence-quality', status: 'pending' },
      { id: 'test-evidence-represents-current-public-build', status: 'pending' },
      { id: 'feature-is-usable-as-storefront-claims', status: 'pending' },
      { id: 'owned-target-authority', status: 'pending' },
    ],
  }
}

function base(normalized, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-supported-feature-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    featureCatalogRevisionRef: normalized.featureCatalogRevisionRef,
    policyRevision: 'steam-supported-features-2026-08-27',
    manualReview: manualReview(),
    platformValidated: false,
    buildValidatedByConnector: false,
    savedToSteamworks: false,
    previewedOnSteam: false,
    published: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt,
  }
}

export function prepareSteamSupportedFeatureReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamSupportedFeatureInput(input)
  const blockers = []
  const refCounts = new Map()
  const nameCounts = new Map()
  for (const feature of normalized.features) {
    refCounts.set(feature.featureRef, (refCounts.get(feature.featureRef) ?? 0) + 1)
    const nameKey = feature.displayName.toLocaleLowerCase('en-US')
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1)
    if (feature.implementationState === 'planned-not-released') blockers.push({ code: 'planned-feature-cannot-be-selected', featureRef: feature.featureRef })
    if (feature.implementationState === 'unknown') blockers.push({ code: 'feature-implementation-unknown', featureRef: feature.featureRef })
  }
  for (const [featureRef, count] of refCounts) if (count > 1) blockers.push({ code: 'duplicate-feature-ref', featureRef })
  for (const [displayName, count] of nameCounts) if (count > 1) blockers.push({ code: 'duplicate-feature-name', displayName })
  blockers.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
  const checks = [
    { id: 'feature-set-present', status: normalized.features.length > 0 ? 'passed' : 'failed' },
    { id: 'unique-feature-refs', status: blockers.some((item) => item.code === 'duplicate-feature-ref') ? 'failed' : 'passed' },
    { id: 'unique-feature-names', status: blockers.some((item) => item.code === 'duplicate-feature-name') ? 'failed' : 'passed' },
    { id: 'current-build-implementation-declared', status: blockers.some((item) => item.code === 'planned-feature-cannot-be-selected' || item.code === 'feature-implementation-unknown') ? 'failed' : 'passed' },
    { id: 'implementation-evidence-bound', status: 'passed' },
    { id: 'test-evidence-bound', status: 'passed' },
  ]
  const common = base(normalized, now().toISOString())
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, features: [], preflight: { checks, blockers } }
  const revisionPayload = {
    schemaVersion: common.schemaVersion,
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    featureCatalogRevisionRef: normalized.featureCatalogRevisionRef,
    policyRevision: common.policyRevision,
    features: normalized.features,
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digestText(stableStringify(revisionPayload)), features: normalized.features, preflight: { checks, blockers: [] } }
}

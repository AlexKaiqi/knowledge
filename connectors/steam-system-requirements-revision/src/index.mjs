import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'buildRevisionRef', 'platforms'])
const PLATFORM_KEYS = new Set(['platform', 'buildArtifactRef', 'depotRefs', 'publicPackageRefs', 'launchTestRefs', 'minimum', 'recommended'])
const REQUIREMENT_KEYS = new Set(['field', 'value', 'evidenceRefs'])
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const PLATFORMS = ['windows', 'macos', 'linux-steamos']
const PLATFORM_ORDER = new Map(PLATFORMS.map((platform, index) => [platform, index]))
const FIELDS = ['os', 'processor', 'memory', 'graphics', 'directx', 'network', 'storage', 'sound-card', 'additional-notes']
const FIELD_ORDER = new Map(FIELDS.map((field, index) => [field, index]))
const CORE_FIELDS = ['os', 'processor', 'memory', 'graphics', 'storage']
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u
const MARKUP = /<\/?[a-z][^>]*>|\[\/?(?:b|i|u|url|img|list|code|table)(?:=[^\]]*)?\]/iu

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function assertRecord(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  const unknown = Object.keys(value).filter((key) => !keys.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function normalizeRef(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500 || value.includes('\0')) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeRefs(values, name, minimum, maximum) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(`${name} must contain ${minimum}..${maximum} references`)
  const normalized = values.map((value, index) => normalizeRef(value, `${name}[${index}]`)).sort()
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique`)
  return normalized
}

function normalizeRequirement(item, name) {
  assertRecord(item, name, REQUIREMENT_KEYS)
  if (!FIELDS.includes(item.field)) throw new Error(`${name}.field is unsupported`)
  if (typeof item.value !== 'string' || item.value.length < 1 || [...item.value].length > 500 || item.value !== item.value.normalize('NFC') || CONTROL_CHARACTERS.test(item.value) || MARKUP.test(item.value)) throw new Error(`${name}.value must be bounded NFC plain single-line text`)
  return { field: item.field, value: item.value, evidenceRefs: normalizeRefs(item.evidenceRefs, `${name}.evidenceRefs`, 1, 10) }
}

function normalizeTier(values, name, minimum) {
  if (!Array.isArray(values) || values.length < minimum || values.length > FIELDS.length) throw new Error(`${name} must contain ${minimum}..${FIELDS.length} requirement entries`)
  const normalized = values.map((item, index) => normalizeRequirement(item, `${name}[${index}]`))
    .sort((left, right) => FIELD_ORDER.get(left.field) - FIELD_ORDER.get(right.field))
  if (new Set(normalized.map((item) => item.field)).size !== normalized.length) throw new Error(`${name} fields must be unique`)
  return normalized
}

export function normalizeSteamSystemRequirementsInput(input) {
  assertRecord(input, 'input', INPUT_KEYS)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.platforms) || input.platforms.length < 1 || input.platforms.length > 3) throw new Error('platforms must contain 1..3 items')
  const platforms = input.platforms.map((item, index) => {
    assertRecord(item, `platforms[${index}]`, PLATFORM_KEYS)
    if (!PLATFORMS.includes(item.platform)) throw new Error(`platforms[${index}].platform is unsupported`)
    return {
      platform: item.platform,
      buildArtifactRef: normalizeRef(item.buildArtifactRef, `platforms[${index}].buildArtifactRef`),
      depotRefs: normalizeRefs(item.depotRefs, `platforms[${index}].depotRefs`, 1, 10),
      publicPackageRefs: normalizeRefs(item.publicPackageRefs, `platforms[${index}].publicPackageRefs`, 1, 10),
      launchTestRefs: normalizeRefs(item.launchTestRefs, `platforms[${index}].launchTestRefs`, 1, 20),
      minimum: normalizeTier(item.minimum, `platforms[${index}].minimum`, 1),
      recommended: normalizeTier(item.recommended, `platforms[${index}].recommended`, 0),
    }
  }).sort((left, right) => PLATFORM_ORDER.get(left.platform) - PLATFORM_ORDER.get(right.platform))
  if (new Set(platforms.map((item) => item.platform)).size !== platforms.length) throw new Error('platforms must be unique')
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: normalizeRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    buildRevisionRef: normalizeRef(input.buildRevisionRef, 'buildRevisionRef'),
    platforms,
  }
}

function missingCore(tier) {
  const present = new Set(tier.map((item) => item.field))
  return CORE_FIELDS.filter((field) => !present.has(field))
}

function manualReview() {
  return {
    required: true,
    checks: [
      { id: 'minimum-is-lowest-supported-configuration', status: 'pending' },
      { id: 'recommended-performance-target-is-defined', status: 'pending' },
      { id: 'build-launches-on-each-listed-platform', status: 'pending' },
      { id: 'store-os-build-depot-package-consistency', status: 'pending' },
      { id: 'hardware-claims-match-test-evidence', status: 'pending' },
      { id: 'os-version-claims-are-current', status: 'pending' },
      { id: 'additional-notes-are-clear-and-non-misleading', status: 'pending' }
    ]
  }
}

export function prepareSteamSystemRequirementsReviewRevision(input, { now = () => new Date() } = {}) {
  const normalized = normalizeSteamSystemRequirementsInput(input)
  const blockers = []
  for (const platform of normalized.platforms) {
    const minimumMissing = missingCore(platform.minimum)
    if (minimumMissing.length > 0) blockers.push({ code: 'minimum-core-fields-missing', platform: platform.platform, fields: minimumMissing })
    if (platform.recommended.length > 0) {
      const recommendedMissing = missingCore(platform.recommended)
      if (recommendedMissing.length > 0) blockers.push({ code: 'recommended-core-fields-missing', platform: platform.platform, fields: recommendedMissing })
    }
    if (platform.platform !== 'windows' && platform.minimum.some((item) => item.field === 'directx')) blockers.push({ code: 'directx-only-valid-for-windows', platform: platform.platform })
    if (platform.platform !== 'windows' && platform.recommended.some((item) => item.field === 'directx')) blockers.push({ code: 'directx-only-valid-for-windows', platform: platform.platform })
  }
  const checks = [
    { id: 'unique-supported-platforms', status: 'passed' },
    { id: 'minimum-core-field-completeness', status: blockers.some((item) => item.code === 'minimum-core-fields-missing') ? 'failed' : 'passed' },
    { id: 'optional-recommended-tier-completeness', status: blockers.some((item) => item.code === 'recommended-core-fields-missing') ? 'failed' : 'passed' },
    { id: 'platform-field-compatibility', status: blockers.some((item) => item.code === 'directx-only-valid-for-windows') ? 'failed' : 'passed' },
    { id: 'build-depot-package-test-evidence-present', status: 'passed' },
  ]
  const base = {
    schemaVersion: 'dsh.steam-system-requirements-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    buildRevisionRef: normalized.buildRevisionRef,
    policyRevision: 'steam-system-requirements-2026-08-27',
    manualReview: manualReview(),
    savedToSteamworks: false,
    previewedOnSteam: false,
    published: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt: now().toISOString(),
  }
  if (blockers.length > 0) return { ...base, status: 'blocked', revisionHash: null, platforms: [], preflight: { checks, blockers } }
  const platforms = normalized.platforms.map((platform) => ({
    ...platform,
    minimum: platform.minimum.map((item) => ({ ...item, valueDigest: digest(item.value) })),
    recommended: platform.recommended.map((item) => ({ ...item, valueDigest: digest(item.value) })),
  }))
  const revisionPayload = {
    schemaVersion: base.schemaVersion,
    gameRef: base.gameRef,
    sourceRevisionRef: base.sourceRevisionRef,
    buildRevisionRef: base.buildRevisionRef,
    platforms,
    policyRevision: base.policyRevision,
  }
  return { ...base, status: 'ready-for-human-review', revisionHash: digest(stableStringify(revisionPayload)), platforms, preflight: { checks, blockers: [] } }
}

export { CORE_FIELDS, FIELDS, PLATFORMS }

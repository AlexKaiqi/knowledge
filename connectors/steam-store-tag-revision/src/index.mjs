import { createHash } from 'node:crypto'

const INPUT_KEYS = new Set(['gameRef', 'sourceRevisionRef', 'catalogRevisionRef', 'tags', 'audienceEvidenceRefs'])
const TAG_KEYS = new Set(['tagRef', 'displayName', 'launchEvidenceRefs'])
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digestText = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`

function assertRef(value, name) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value.trim()
}

function normalizeRefs(values, name, maximum) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) throw new Error(`${name} must contain 1..${maximum} references`)
  const normalized = values.map((value, index) => assertRef(value, `${name}[${index}]`))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${name} references must be unique`)
  return normalized.sort()
}

function normalizeDisplayName(value, name) {
  if (typeof value !== 'string' || value.trim() !== value || [...value].length < 1 || [...value].length > 80) throw new Error(`${name} must contain 1..80 trimmed code points`)
  if (value !== value.normalize('NFC')) throw new Error(`${name} must be NFC-normalized`)
  if (CONTROL_CHARACTERS.test(value)) throw new Error(`${name} contains unsupported control characters`)
  return value
}

export function normalizeSteamStoreTagInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`input contains unsupported fields: ${unknown.join(', ')}`)
  if (typeof input.gameRef !== 'string' || !SAFE_ID.test(input.gameRef)) throw new Error('gameRef must be opaque and bounded')
  if (!Array.isArray(input.tags) || input.tags.length < 1 || input.tags.length > 25) throw new Error('tags must contain 1..25 items')
  const tags = input.tags.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`tags[${index}] must be an object`)
    const extra = Object.keys(item).filter((key) => !TAG_KEYS.has(key))
    if (extra.length > 0) throw new Error(`tags[${index}] contains unsupported fields: ${extra.join(', ')}`)
    return {
      tagRef: assertRef(item.tagRef, `tags[${index}].tagRef`),
      displayName: normalizeDisplayName(item.displayName, `tags[${index}].displayName`),
      launchEvidenceRefs: normalizeRefs(item.launchEvidenceRefs, `tags[${index}].launchEvidenceRefs`, 10)
    }
  })
  return {
    gameRef: input.gameRef,
    sourceRevisionRef: assertRef(input.sourceRevisionRef, 'sourceRevisionRef'),
    catalogRevisionRef: assertRef(input.catalogRevisionRef, 'catalogRevisionRef'),
    tags,
    audienceEvidenceRefs: normalizeRefs(input.audienceEvidenceRefs, 'audienceEvidenceRefs', 30)
  }
}

function manualReview() {
  return {
    required: true,
    checks: [
      { id: 'current-platform-tag-availability', status: 'pending' },
      { id: 'top-five-clear-picture', status: 'pending' },
      { id: 'tag-relevance-and-specificity', status: 'pending' },
      { id: 'ordering-and-discovery-intent', status: 'pending' },
      { id: 'launch-build-consistency', status: 'pending' },
      { id: 'audience-evidence-quality', status: 'pending' },
      { id: 'owned-target-authority', status: 'pending' }
    ]
  }
}

function base(normalized, preparedAt) {
  return {
    schemaVersion: 'dsh.steam-store-tag-review-revision/v1',
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    catalogRevisionRef: normalized.catalogRevisionRef,
    audienceEvidenceRefs: normalized.audienceEvidenceRefs,
    policyRevision: 'steam-store-tags-2026-08-27',
    manualReview: manualReview(),
    platformValidated: false,
    savedToSteamworks: false,
    published: false,
    markedReadyForReview: false,
    released: false,
    executionAuthorized: false,
    preparedAt
  }
}

export function prepareSteamStoreTagReviewRevision(input, { now = () => new Date(), minimumTags = 5, maximumTags = 20 } = {}) {
  const normalized = normalizeSteamStoreTagInput(input)
  if (!Number.isSafeInteger(minimumTags) || minimumTags < 1 || !Number.isSafeInteger(maximumTags) || maximumTags < minimumTags || maximumTags > 25) throw new Error('tag limits are invalid')
  const blockers = []
  if (normalized.tags.length < minimumTags) blockers.push({ code: 'tag-count-below-minimum', minimum: minimumTags, observed: normalized.tags.length })
  if (normalized.tags.length > maximumTags) blockers.push({ code: 'tag-count-above-maximum', maximum: maximumTags, observed: normalized.tags.length })
  const refCounts = new Map()
  const nameCounts = new Map()
  for (const tag of normalized.tags) {
    refCounts.set(tag.tagRef, (refCounts.get(tag.tagRef) ?? 0) + 1)
    const nameKey = tag.displayName.toLocaleLowerCase('en-US')
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1)
  }
  for (const [tagRef, count] of refCounts) if (count > 1) blockers.push({ code: 'duplicate-tag-ref', tagRef })
  for (const [displayName, count] of nameCounts) if (count > 1) blockers.push({ code: 'duplicate-tag-name', displayName })
  const checks = [
    { id: 'official-tag-count', status: blockers.some((item) => item.code.startsWith('tag-count-')) ? 'failed' : 'passed' },
    { id: 'unique-tag-refs', status: blockers.some((item) => item.code === 'duplicate-tag-ref') ? 'failed' : 'passed' },
    { id: 'unique-tag-names', status: blockers.some((item) => item.code === 'duplicate-tag-name') ? 'failed' : 'passed' },
    { id: 'launch-evidence-bound', status: 'passed' },
    { id: 'ordered-top-five-present', status: normalized.tags.length >= 5 ? 'passed' : 'failed' }
  ]
  const common = base(normalized, now().toISOString())
  if (blockers.length > 0) return { ...common, status: 'blocked', revisionHash: null, tags: [], preflight: { checks, blockers } }
  const tags = normalized.tags.map((tag, index) => ({ ...tag, rank: index + 1, topFive: index < 5 }))
  const revisionPayload = {
    schemaVersion: common.schemaVersion,
    gameRef: normalized.gameRef,
    sourceRevisionRef: normalized.sourceRevisionRef,
    catalogRevisionRef: normalized.catalogRevisionRef,
    audienceEvidenceRefs: normalized.audienceEvidenceRefs,
    tags,
    policyRevision: common.policyRevision
  }
  return { ...common, status: 'ready-for-human-review', revisionHash: digestText(stableStringify(revisionPayload)), tags, preflight: { checks, blockers: [] } }
}

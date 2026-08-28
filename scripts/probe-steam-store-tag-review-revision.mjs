import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamStoreTagReviewRevision } from '../connectors/steam-store-tag-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/steam-store-tags.json'), 'utf8'))
const sources = [
  {
    id: 'steam-tags',
    url: 'https://partner.steamgames.com/doc/store/tags?l=english&language=english',
    assertions: ['requiring at least 5 tags', 'recommend you add up to 20', "top 5 tags should paint a fairly clear picture", 'impact where and how it appears on Steam']
  },
  {
    id: 'steam-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?l=english&language=english',
    assertions: ['All supported features listed on the store page will need to be implemented in the current build', 'remove the selected feature in the Basic Info tab until it is implemented and released', 'Mark as ready for review']
  },
  {
    id: 'steam-store-page',
    url: 'https://partner.steamgames.com/doc/store/page?l=english&language=english',
    assertions: ['sections marked with a (*)', 'Store Beta Mode', 'Prepare for Publishing', 'move ALL store page data and assets']
  }
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-tag-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-store-tag-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-store-tag-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam tag input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareSteamStoreTagReviewRevision(fixture, { now: () => new Date('2026-08-27T06:20:00Z') })
const replay = prepareSteamStoreTagReviewRevision(fixture, { now: () => new Date('2026-08-28T06:20:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic tag revision replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam tag output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.platformValidated || prepared.savedToSteamworks || prepared.published || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')

const mutations = []
const reordered = structuredClone(fixture); [reordered.tags[0], reordered.tags[1]] = [reordered.tags[1], reordered.tags[0]]; mutations.push(reordered)
const renamed = structuredClone(fixture); renamed.tags[0].displayName = 'Logic'; mutations.push(renamed)
const launchEvidence = structuredClone(fixture); launchEvidence.tags[0].launchEvidenceRefs.push('build:puzzle-proof-v2'); mutations.push(launchEvidence)
const audienceEvidence = structuredClone(fixture); audienceEvidence.audienceEvidenceRefs.push('research:audience-v2'); mutations.push(audienceEvidence)
mutations.push({ ...fixture, catalogRevisionRef: 'steam-tags:observed-next' })
for (const mutation of mutations) if (prepareSteamStoreTagReviewRevision(mutation).revisionHash === prepared.revisionHash) throw new Error('tag revision mutation was not bound')

const tooFew = prepareSteamStoreTagReviewRevision({ ...fixture, tags: fixture.tags.slice(0, 4) })
if (!tooFew.preflight.blockers.some((item) => item.code === 'tag-count-below-minimum')) throw new Error('minimum tag count was not blocked')
const tooManyTags = Array.from({ length: 21 }, (_, index) => ({ tagRef: `steam-tag:${index}`, displayName: `Tag ${index}`, launchEvidenceRefs: [`evidence:${index}`] }))
const tooMany = prepareSteamStoreTagReviewRevision({ ...fixture, tags: tooManyTags })
if (!tooMany.preflight.blockers.some((item) => item.code === 'tag-count-above-maximum')) throw new Error('maximum tag count was not blocked')
const duplicate = structuredClone(fixture); duplicate.tags[1].tagRef = duplicate.tags[0].tagRef
if (!prepareSteamStoreTagReviewRevision(duplicate).preflight.blockers.some((item) => item.code === 'duplicate-tag-ref')) throw new Error('duplicate tag ref was not blocked')

const snapshotPath = path.join(root, 'knowledge/verifications/steam/store-tag-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/store-tag-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'ordered-owned-game-steam-tags', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-store-tag-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-store-tag-review-revision.md',
  connectorId: 'steam-store-tag-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-store-tag-review-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-tag-rules', status: 'passed' },
    { id: 'launch-build-consistency-rule', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'mutation-binding', status: 'passed' },
    { id: 'count-and-uniqueness-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' }
  ],
  evidence: [
    ...evidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/store-tag-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamSupportedFeatureReviewRevision } from '../connectors/steam-supported-feature-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/steam-supported-features.json'), 'utf8'))
const sources = [
  {
    id: 'steam-review-process', url: 'https://partner.steamgames.com/doc/store/review_process?l=english&language=english',
    assertions: ['All supported features listed on the store page will need to be implemented in the current build', "If you intend to add a feature in the future, you'll need to remove the selected feature in the Basic Info tab until it is implemented and released", 'Mark as ready for review'],
  },
  {
    id: 'steam-store-page', url: 'https://partner.steamgames.com/doc/store/page?l=english&language=english',
    assertions: ['sections marked with a (*)', 'Store Beta Mode', 'Prepare for Publishing'],
  },
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-supported-feature-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-supported-feature-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-supported-feature-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam supported-feature input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareSteamSupportedFeatureReviewRevision(fixture, { now: () => new Date('2026-08-27T09:15:00Z') })
const replay = prepareSteamSupportedFeatureReviewRevision(fixture, { now: () => new Date('2026-08-28T09:15:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic supported-feature revision replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam supported-feature output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.platformValidated || prepared.buildValidatedByConnector || prepared.savedToSteamworks || prepared.previewedOnSteam || prepared.published || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')

const mutations = []
mutations.push({ ...fixture, buildRevisionRef: 'build:steam-public-candidate-v8' })
mutations.push({ ...fixture, featureCatalogRevisionRef: 'steam-features:observed-next' })
const renamed = structuredClone(fixture); renamed.features[0].displayName = 'Family library sharing'; mutations.push(renamed)
const implementation = structuredClone(fixture); implementation.features[0].implementationEvidenceRefs.push('build-proof:family-sharing-v2'); mutations.push(implementation)
const testEvidence = structuredClone(fixture); testEvidence.features[0].testEvidenceRefs.push('test:family-library-access-v2'); mutations.push(testEvidence)
for (const mutation of mutations) if (prepareSteamSupportedFeatureReviewRevision(mutation).revisionHash === prepared.revisionHash) throw new Error('supported-feature revision mutation was not bound')

const planned = structuredClone(fixture); planned.features[0].implementationState = 'planned-not-released'
if (!prepareSteamSupportedFeatureReviewRevision(planned).preflight.blockers.some((item) => item.code === 'planned-feature-cannot-be-selected')) throw new Error('planned feature was not blocked')
const unknown = structuredClone(fixture); unknown.features[0].implementationState = 'unknown'
if (!prepareSteamSupportedFeatureReviewRevision(unknown).preflight.blockers.some((item) => item.code === 'feature-implementation-unknown')) throw new Error('unknown feature state was not blocked')
const duplicate = structuredClone(fixture); duplicate.features[1].featureRef = duplicate.features[0].featureRef
if (!prepareSteamSupportedFeatureReviewRevision(duplicate).preflight.blockers.some((item) => item.code === 'duplicate-feature-ref')) throw new Error('duplicate feature ref was not blocked')

const snapshotPath = path.join(root, 'knowledge/verifications/steam/supported-feature-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/supported-feature-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-game-current-build-supported-features', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `steam-supported-feature-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-supported-feature-review-revision.md', connectorId: 'steam-supported-feature-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-supported-feature-review-revision-local.json', environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-supported-feature-rules', status: 'passed' }, { id: 'future-feature-removal-rule', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' }, { id: 'mutation-binding', status: 'passed' },
    { id: 'planned-unknown-and-duplicate-blockers', status: 'passed' }, { id: 'manual-review-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' }, { id: 'non-platform-write-boundary', status: 'passed' },
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/supported-feature-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, features: prepared.features.length, expiresAt: report.expiresAt }, null, 2))

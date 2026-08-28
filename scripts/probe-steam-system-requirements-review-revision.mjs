import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamSystemRequirementsReviewRevision } from '../connectors/steam-system-requirements-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/steam/system-requirements-owned-game.json'), 'utf8'))
const sources = [
  {
    id: 'steam-platforms',
    url: 'https://partner.steamgames.com/doc/store/application/platforms?l=english&language=english',
    assertions: ['Steam provides support for Windows, macOS, and Linux (SteamOS).', 'Set that build to a beta branch with a password.', 'add the necessary depots to any public packages', 'enter the corresponding system requirements', 'Preview your store page']
  },
  {
    id: 'steam-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?l=english&language=english',
    assertions: ['successfully launch in all supported operating systems listed on the store page', 'All supported features listed on the store page will need to be implemented in the current build', 'Mark as ready for review']
  },
  {
    id: 'portal-2-store-page',
    url: 'https://store.steampowered.com/app/620/Portal_2/?l=english',
    assertions: ['System Requirements', 'Minimum:', 'Processor:', 'Memory:', 'Graphics:', 'Storage:']
  }
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-system-requirements-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-system-requirements-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-system-requirements-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam system requirements input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareSteamSystemRequirementsReviewRevision(fixture, { now: () => new Date('2026-08-27T08:00:00Z') })
const reorderedFixture = structuredClone(fixture)
reorderedFixture.platforms.reverse()
const replay = prepareSteamSystemRequirementsReviewRevision(reorderedFixture, { now: () => new Date('2026-08-28T08:00:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic system requirements replay failed')
if (prepared.platforms.map((item) => item.platform).join(',') !== 'windows,macos,linux-steamos') throw new Error('platform normalization mismatch')
if (!validateOutput(prepared)) throw new Error(`Steam system requirements output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.savedToSteamworks || prepared.previewedOnSteam || prepared.published || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')

const baseHash = prepared.revisionHash
const mutations = []
const build = structuredClone(fixture); build.platforms[0].buildArtifactRef = 'artifact:windows-x64-v2'; mutations.push(build)
const depot = structuredClone(fixture); depot.platforms[0].depotRefs = ['steam-depot:windows-x64-v2']; mutations.push(depot)
const packageRevision = structuredClone(fixture); packageRevision.platforms[0].publicPackageRefs = ['steam-package:base-game-v2']; mutations.push(packageRevision)
const launch = structuredClone(fixture); launch.platforms[0].launchTestRefs.push('test:windows-minimum-launch-v2'); mutations.push(launch)
const value = structuredClone(fixture); value.platforms[0].minimum.find((item) => item.field === 'memory').value = '12 GB RAM'; mutations.push(value)
const requirementEvidence = structuredClone(fixture); requirementEvidence.platforms[0].minimum.find((item) => item.field === 'memory').evidenceRefs = ['evidence:windows-min-memory-v2']; mutations.push(requirementEvidence)
for (const mutation of mutations) if (prepareSteamSystemRequirementsReviewRevision(mutation).revisionHash === baseHash) throw new Error('system requirements mutation was not bound')

const missing = structuredClone(fixture); missing.platforms[0].minimum = missing.platforms[0].minimum.filter((item) => item.field !== 'storage')
if (!prepareSteamSystemRequirementsReviewRevision(missing).preflight.blockers.some((item) => item.code === 'minimum-core-fields-missing')) throw new Error('missing minimum core field was not blocked')
const partial = structuredClone(fixture); partial.platforms[1].recommended = partial.platforms[1].minimum.slice(0, 2)
if (!prepareSteamSystemRequirementsReviewRevision(partial).preflight.blockers.some((item) => item.code === 'recommended-core-fields-missing')) throw new Error('partial recommended tier was not blocked')
const directx = structuredClone(fixture); directx.platforms[2].minimum.push({ field: 'directx', value: 'Version 11', evidenceRefs: ['evidence:invalid-linux-directx'] })
if (!prepareSteamSystemRequirementsReviewRevision(directx).preflight.blockers.some((item) => item.code === 'directx-only-valid-for-windows')) throw new Error('non-Windows DirectX was not blocked')

const snapshotPath = path.join(root, 'knowledge/verifications/steam/system-requirements-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/system-requirements-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-three-platform-system-requirements', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-system-requirements-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-system-requirements-review-revision.md',
  connectorId: 'steam-system-requirements-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-system-requirements-review-revision-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-platform-and-review-rules', status: 'passed' },
    { id: 'first-party-public-field-shape', status: 'passed' },
    { id: 'deterministic-replay-and-platform-normalization', status: 'passed' },
    { id: 'build-and-requirement-mutation-binding', status: 'passed' },
    { id: 'completeness-and-compatibility-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' }
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/system-requirements-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

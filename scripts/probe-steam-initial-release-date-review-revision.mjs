import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamInitialReleaseDateReviewRevision } from '../connectors/steam-initial-release-date-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/steam/initial-release-date-owned-game.json'), 'utf8'))
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/steam-initial-release-date-revision-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const evidence = []

for (const source of catalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-initial-release-date-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ')
    .replace(/\s+/g, ' ')
  for (const assertion of source.observation.assertions) if (!text.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-initial-release-date-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-initial-release-date-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam initial release-date input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const fixedNow = () => new Date('2026-08-27T12:00:00.000Z')
const prepared = prepareSteamInitialReleaseDateReviewRevision(fixture, { now: fixedNow })
const replay = prepareSteamInitialReleaseDateReviewRevision(fixture, { now: () => new Date('2026-08-27T13:00:00.000Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic release-date replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam initial release-date output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (prepared.target.display.rangeStart !== '2026-10-01' || prepared.target.display.rangeEnd !== '2026-10-31' || prepared.target.display.upcomingListPlacementDate !== '2026-10-31') throw new Error('month-year display projection mismatch')
if (prepared.timing.comingSoonLeadDays !== 90 || !prepared.timing.minimumComingSoonSatisfied) throw new Error('Coming Soon lead-time projection mismatch')
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.platformStateAuthenticated || prepared.savedToSteamworks || prepared.comingSoonChanged || prepared.releaseButtonPressed || prepared.released || prepared.wishlistNotificationsTriggered || prepared.executionAuthorized) throw new Error('Steamworks effect boundary mismatch')

const displayModes = ['exact-date', 'month-year', 'quarter', 'year', 'coming-soon']
for (const playerFacingDisplay of displayModes) {
  const result = prepareSteamInitialReleaseDateReviewRevision({ ...fixture, target: { ...fixture.target, playerFacingDisplay } }, { now: fixedNow })
  if (result.status !== 'ready-for-human-review') throw new Error(`${playerFacingDisplay} display unexpectedly blocked`)
  if (playerFacingDisplay === 'coming-soon' && (result.target.display.rangeStart !== null || result.target.display.upcomingListPlacementDate !== null || result.target.display.upcomingListPlacementSemantics !== 'behind-dated-displays')) throw new Error('Coming Soon placement boundary mismatch')
  if (playerFacingDisplay !== 'coming-soon' && result.target.display.upcomingListPlacementDate === null) throw new Error(`${playerFacingDisplay} missing list placement date`)
}

const baseHash = prepared.revisionHash
const mutations = []
const store = structuredClone(fixture); store.storeRevisionRef = 'revision:steam-store-page-v8'; mutations.push(store)
const build = structuredClone(fixture); build.buildRevisionRef = 'revision:owned-build-v5'; mutations.push(build)
const observation = structuredClone(fixture); observation.observedReleaseState.evidenceRefs.push('evidence:release-state-v2'); mutations.push(observation)
const exactDate = structuredClone(fixture); exactDate.target.specifiedReleaseDate = '2026-11-06'; mutations.push(exactDate)
const display = structuredClone(fixture); display.target.playerFacingDisplay = 'quarter'; mutations.push(display)
const decision = structuredClone(fixture); decision.target.decisionEvidenceRefs = ['decision:launch-plan-v4']; mutations.push(decision)
for (const mutation of mutations) if (prepareSteamInitialReleaseDateReviewRevision(mutation, { now: fixedNow }).revisionHash === baseHash) throw new Error('release-date mutation was not bound')

const blockers = []
const released = structuredClone(fixture); released.observedReleaseState.releaseState = 'released'; blockers.push([released, fixedNow, 'already-released'])
const stale = structuredClone(fixture); stale.observedReleaseState.observedAt = '2026-08-25T08:00:00.000Z'; blockers.push([stale, fixedNow, 'observed-state-stale'])
const noComingSoon = structuredClone(fixture); noComingSoon.observedReleaseState.comingSoonPublishedDate = null; blockers.push([noComingSoon, fixedNow, 'coming-soon-not-published'])
const shortComingSoon = structuredClone(fixture); shortComingSoon.observedReleaseState.comingSoonPublishedDate = '2026-10-20'; blockers.push([shortComingSoon, () => new Date('2026-10-20T12:00:00.000Z'), 'coming-soon-minimum-not-met'])
const review = structuredClone(fixture); review.observedReleaseState.storePresenceReviewState = 'in-review'; blockers.push([review, fixedNow, 'store-presence-not-ready'])
const locked = structuredClone(fixture); locked.observedReleaseState.observedAt = '2026-10-20T08:00:00.000Z'; locked.target.specifiedReleaseDate = '2026-11-15'; blockers.push([locked, () => new Date('2026-10-20T12:00:00.000Z'), 'specified-date-change-locked'])
for (const [input, now, code] of blockers) {
  const result = prepareSteamInitialReleaseDateReviewRevision(input, { now })
  if (result.status !== 'blocked' || !result.preflight.blockers.some((item) => item.code === code) || !validateOutput(result)) throw new Error(`release-date blocker missing: ${code}`)
}

const snapshotPath = path.join(root, 'knowledge/verifications/steam/initial-release-date-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/initial-release-date-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-initial-release-date-plan', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-initial-release-date-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-initial-release-date-review-revision.md',
  connectorId: 'steam-initial-release-date-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-initial-release-date-review-revision-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-release-date-coming-soon-and-release-rules', status: 'passed' },
    { id: 'exact-date-and-five-display-projections', status: 'passed' },
    { id: 'upcoming-list-placement-semantics', status: 'passed' },
    { id: 'deterministic-replay-and-mutation-binding', status: 'passed' },
    { id: 'coming-soon-review-freshness-and-lock-blockers', status: 'passed' },
    { id: 'manual-review-and-unauthenticated-state-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' }
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/initial-release-date-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

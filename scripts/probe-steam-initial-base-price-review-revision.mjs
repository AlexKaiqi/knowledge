import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamInitialBasePriceReviewRevision } from '../connectors/steam-initial-base-price-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const DAY = 24 * 60 * 60 * 1000
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/steam-initial-base-prices.json'), 'utf8'))
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/steam-initial-base-price-revision-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const evidence = []

for (const source of catalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-initial-base-price-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ')
  for (const assertion of source.observation.assertions) if (!text.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-initial-base-price-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-initial-base-price-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam initial base-price input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const fixedNow = () => new Date('2026-08-27T12:00:00.000Z')
const prepared = prepareSteamInitialBasePriceReviewRevision(fixture, { now: fixedNow })
const replay = prepareSteamInitialBasePriceReviewRevision(fixture, { now: () => new Date('2026-08-27T13:00:00.000Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic initial base-price replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam initial base-price output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.coverage.completeObservedMarketSet || prepared.coverage.expectedMarketCount !== 41 || prepared.coverage.liveCurrencyCount !== 37 || prepared.coverage.usdRegionGroupCount !== 4) throw new Error('Steam price market coverage mismatch')
if (prepared.coverage.minimumThresholdsAuthenticated || prepared.coverage.pricingCatalogAuthenticated || prepared.coverage.discountsIncluded || prepared.coverage.subsequentPriceChangesIncluded) throw new Error('Steam price coverage overclaim')
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual pricing review boundary mismatch')
if (prepared.platformStateAuthenticated || prepared.priceValidityConfirmed || prepared.csvGenerated || prepared.submittedToValve || prepared.approvedByValve || prepared.publishedToSteam || prepared.discountConfigured || prepared.automaticSchedulingSupported || prepared.executionAuthorized) throw new Error('Steam pricing effect boundary mismatch')

const baseHash = prepared.revisionHash
const mutations = []
const packageMutation = structuredClone(fixture); packageMutation.packageRef = 'package:standard-base-game-v2'; mutations.push(packageMutation)
const catalogMutation = structuredClone(fixture); catalogMutation.pricingCatalogRevisionRef = 'catalog:steam-live-currencies-v4'; mutations.push(catalogMutation)
const thresholdMutation = structuredClone(fixture); thresholdMutation.minimumThresholdRevisionRef = 'thresholds:steam-2026-08-28'; mutations.push(thresholdMutation)
const buildMutation = structuredClone(fixture); buildMutation.buildRevisionRef = 'revision:owned-build-v5'; mutations.push(buildMutation)
const amountMutation = structuredClone(fixture); amountMutation.target.pricePoints.find((point) => point.marketCode === 'USD').amountMinorUnits += 1; mutations.push(amountMutation)
const researchMutation = structuredClone(fixture); researchMutation.target.marketResearchEvidenceRefs = ['evidence:comparable-games-v2']; mutations.push(researchMutation)
const modeMutation = structuredClone(fixture); modeMutation.target.publishMode = 'valve-publish-after-review'; mutations.push(modeMutation)
for (const mutation of mutations) if (prepareSteamInitialBasePriceReviewRevision(mutation, { now: fixedNow }).revisionHash === baseHash) throw new Error('initial base-price mutation was not bound')

const blockers = []
const missing = structuredClone(fixture); missing.target.pricePoints.pop(); blockers.push([missing, 'missing-market-prices'])
const low = structuredClone(fixture); low.target.pricePoints.find((point) => point.marketCode === 'USD').amountMinorUnits = 98; blockers.push([low, 'price-below-observed-minimum'])
const increment = structuredClone(fixture); increment.target.pricePoints.find((point) => point.marketCode === 'JPY').amountMinorUnits += 1; blockers.push([increment, 'currency-increment-invalid'])
const stale = structuredClone(fixture); stale.observedPricingState.observedAt = '2026-08-25T08:00:00.000Z'; blockers.push([stale, 'observed-state-stale'])
const released = structuredClone(fixture); released.observedPricingState.releaseState = 'released'; blockers.push([released, 'already-released'])
const missingPackage = structuredClone(fixture); missingPackage.observedPricingState.packageState = 'missing'; blockers.push([missingPackage, 'standard-package-missing'])
const submitted = structuredClone(fixture); submitted.observedPricingState.pricingSubmissionState = 'under-review'; blockers.push([submitted, 'initial-pricing-already-submitted'])
const existing = structuredClone(fixture); existing.observedPricingState.currentPriceScheduleDigest = `sha256:${'a'.repeat(64)}`; blockers.push([existing, 'existing-price-schedule-requires-update-capability'])
const discounted = structuredClone(fixture); discounted.observedPricingState.activeOrScheduledDiscount = true; blockers.push([discounted, 'discount-state-conflicts-with-base-price-preparation'])
for (const [input, code] of blockers) {
  const result = prepareSteamInitialBasePriceReviewRevision(input, { now: fixedNow })
  if (result.status !== 'blocked' || !result.preflight.blockers.some((item) => item.code === code) || !validateOutput(result)) throw new Error(`initial base-price blocker missing: ${code}`)
}

const snapshotPath = path.join(root, 'knowledge/verifications/steam/initial-base-price-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/initial-base-price-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-initial-base-price-plan', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * DAY)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `steam-initial-base-price-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-initial-base-price-review-revision.md', connectorId: 'steam-initial-base-price-revision', probeDefinitionRef: 'repo:/probes/definitions/steam-initial-base-price-review-revision-local.json', environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-pricing-currency-csv-and-discount-semantics', status: 'passed' },
    { id: 'complete-37-currency-and-4-region-group-coverage', status: 'passed' },
    { id: 'minor-unit-increment-and-observed-minimum-blockers', status: 'passed' },
    { id: 'deterministic-replay-and-mutation-binding', status: 'passed' },
    { id: 'initial-package-state-and-freshness-blockers', status: 'passed' },
    { id: 'manual-review-and-unauthenticated-threshold-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' }
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/initial-base-price-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

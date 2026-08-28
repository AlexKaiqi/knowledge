import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { projectReviewPageToFeedbackObservationWindow } from '../connectors/steam-public-game-reviews/src/index.mjs'
import { reconcileFeedbackObservations } from '../connectors/feedback-observation-reconciler/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const startedAt = new Date()
const upstreamReportPath = path.join(root, 'knowledge/verifications/steam/public-game-reviews/report.json')
const upstreamSnapshotPath = path.join(root, 'knowledge/verifications/steam/public-game-reviews/snapshot.json')
const upstreamReport = JSON.parse(await readFile(upstreamReportPath, 'utf8'))
const upstreamSnapshotBytes = await readFile(upstreamSnapshotPath)
if (upstreamReport.outcome !== 'passed' || Date.parse(upstreamReport.expiresAt) <= startedAt.getTime()) throw new Error('upstream Steam live report is absent, failed, or expired')
const snapshotEvidence = upstreamReport.evidence.find((item) => item.ref === 'repo:/knowledge/verifications/steam/public-game-reviews/snapshot.json')
if (!snapshotEvidence || snapshotEvidence.sha256 !== sha256(upstreamSnapshotBytes)) throw new Error('upstream Steam snapshot digest does not match its live report')
const stored = JSON.parse(upstreamSnapshotBytes)
const { schemaVersion: _schemaVersion, fixture: _fixture, ...page } = stored
const result = projectReviewPageToFeedbackObservationWindow(page)
const reordered = projectReviewPageToFeedbackObservationWindow({ ...page, reviews: [...page.reviews].reverse() })
if (result.resultDigest !== reordered.resultDigest) throw new Error('projection is not order-stable')
if (result.window.completeness !== 'partial' || result.checkpointRecommendation.action !== 'hold') throw new Error('partial-window checkpoint boundary changed')
if (result.coverage.corpusComplete !== false || result.coverage.explicitLifecycleTombstones !== false || result.coverage.absenceDeletionInferenceAllowed !== false) throw new Error('coverage boundary changed')
if (result.executionAuthorized !== false) throw new Error('projection authorized execution')

const changedPage = structuredClone(page)
const changedRef = `steam-review:${changedPage.reviews[0].recommendationId}`
changedPage.observedAt = new Date(Date.parse(page.observedAt) + 60_000).toISOString()
changedPage.reviews[0].text.sha256 = changedPage.reviews[0].text.sha256 === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64)
changedPage.reviews[0].updatedAt = changedPage.observedAt
const changed = projectReviewPageToFeedbackObservationWindow(changedPage)
const reconciliation = reconcileFeedbackObservations({
  sourceRef: result.sourceRef,
  targetRef: result.targetRef,
  priorWindow: result.window,
  currentWindow: changed.window,
})
if (!reconciliation.changes.find((item) => item.itemRef === changedRef)?.mutations.includes('edited')) throw new Error('semantic review change was not reconciled as edited')
if (reconciliation.checkpointRecommendation.action !== 'hold' || reconciliation.deletionInferencePolicy !== 'explicit-lifecycle-only') throw new Error('downstream reconciliation weakened checkpoint or deletion policy')

const forbidden = /"(?:value|author|steamid|username|profile|email)"\s*:/i
if (forbidden.test(JSON.stringify(result))) throw new Error('projection retained feedback text or person fields')
const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/project-review-page-to-observation-window-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`projection schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/steam/review-observation-projection/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/review-observation-projection/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'verified-redacted-steam-review-page', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(Math.min(Date.parse(upstreamReport.expiresAt), finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000))
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-review-observation-projection-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/project-review-page-to-observation-window.md',
  connectorId: 'steam-public-game-reviews',
  probeDefinitionRef: 'repo:/probes/definitions/steam-review-observation-projection-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'upstream-live-evidence-current', status: 'passed' },
    { id: 'partial-window-only', status: 'passed' },
    { id: 'resume-cursor-not-high-watermark', status: 'passed' },
    { id: 'semantic-edit-detected', status: 'passed' },
    { id: 'absence-is-not-deletion', status: 'passed' },
    { id: 'order-stable-replay', status: 'passed' },
    { id: 'no-text-identity-or-execution', status: 'passed' },
    { id: 'output-schema', status: 'passed' }
  ],
  evidence: [
    { kind: 'artifact', ref: 'repo:/knowledge/verifications/steam/public-game-reviews/report.json', sha256: sha256(await readFile(upstreamReportPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/public-game-reviews/snapshot.json', sha256: sha256(upstreamSnapshotBytes) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/review-observation-projection/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

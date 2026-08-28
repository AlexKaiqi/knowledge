import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readPublicGameReviewPage, redactReviewTextForVerification } from '../connectors/steam-public-game-reviews/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(root, 'knowledge/schemas/steam/read-public-game-review-page-output.schema.json')
const snapshotPath = path.join(root, 'knowledge/verifications/steam/public-game-reviews/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/public-game-reviews/report.json')
const input = { appId: 620, filter: 'updated', language: 'english', reviewType: 'all', purchaseType: 'all', cursor: '*', perPage: 5, includeOfftopic: false }
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const startedAt = new Date()
const result = await readPublicGameReviewPage(input)
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`live result schema mismatch: ${JSON.stringify(validate.errors)}`)
if (result.conformance.status !== 'passed') throw new Error('live result requires review')
if (result.reviews.length < 1 || result.reviews.length > input.perPage) throw new Error('live review page is empty or exceeds the probe bound')
if (!result.summary || result.summary.returnedCount !== result.reviews.length) throw new Error('first-page query summary is missing or inconsistent')
if (!result.reviews.every((review, index, reviews) => index === 0 || review.updatedAt <= reviews[index - 1].updatedAt)) throw new Error('updated review page is not ordered by descending update time')
if (JSON.stringify(result).includes('steamid') || JSON.stringify(result).includes('profile_url') || JSON.stringify(result).includes('personaname')) throw new Error('normalized result retained author identity')

const snapshot = {
  schemaVersion: 'dsh.probe-snapshot/steam-public-game-reviews/v1',
  fixture: { appId: 620, title: 'Portal 2', purpose: 'stable public review endpoint conformance' },
  ...redactReviewTextForVerification(result),
}
const { schemaVersion: _schemaVersion, fixture: _fixture, ...snapshotPayload } = snapshot
if (!validate(snapshotPayload)) throw new Error(`redacted snapshot schema mismatch: ${JSON.stringify(validate.errors)}`)
if (JSON.stringify(snapshot.reviews).includes('"value"')) throw new Error('verification snapshot retained review text')

await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-public-game-reviews-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/read-public-game-review-page.md',
  connectorId: 'steam-public-game-reviews',
  probeDefinitionRef: 'repo:/probes/definitions/steam-public-game-reviews-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-endpoint-live', status: 'passed' },
    { id: 'bounded-page', status: 'passed' },
    { id: 'updated-order', status: 'passed' },
    { id: 'query-summary', status: 'passed' },
    { id: 'cursor-present', status: 'passed' },
    { id: 'author-identity-removed', status: 'passed' },
    { id: 'durable-text-redacted', status: 'passed' },
    { id: 'coverage-explicit', status: 'passed' }
  ],
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/public-game-reviews/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, reviewCount: result.reviews.length, expiresAt: report.expiresAt }, null, 2))

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readPublicAppReviewSnapshot, redactReviewTextForVerification } from '../connectors/appfigures-public-app-reviews/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stageRoot = path.join(root, '.staging/verifications/appfigures-public-app-reviews/live')
const snapshotPath = path.join(stageRoot, 'snapshot.json')
const reportPath = path.join(stageRoot, 'report.json')
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const reconcileOnly = process.argv.includes('--reconcile')

const reportSchema = JSON.parse(await readFile(path.join(root, 'spec/probe-report.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateReport = ajv.compile(reportSchema)

async function writeReport({ snapshot, outcome, creditStatus, finishedAt = new Date() }) {
  const expiresAt = new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  const credit = snapshot.creditReconciliation
  const report = {
    schemaVersion: 'dsh.probe-report/v1',
    id: `appfigures-public-app-reviews-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
    capabilityRef: '/capabilities/research/read-public-app-review-snapshot.md',
    connectorId: 'appfigures-public-app-reviews',
    probeDefinitionRef: 'repo:/probes/definitions/appfigures-public-app-reviews-live.json',
    identityPoolRef: 'identity-pool:appfigures-provider-probes',
    environment: 'production-public',
    level: 'live',
    outcome,
    startedAt: snapshot.startedAt,
    finishedAt: finishedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    checks: [
      { id: 'store-id-resolution', status: 'passed' },
      { id: 'bounded-review-snapshot', status: 'passed' },
      { id: 'apple-territory-semantics', status: 'passed' },
      { id: 'author-and-provider-ids-removed', status: 'passed' },
      { id: 'response-status-omitted', status: 'passed' },
      { id: 'durable-text-redacted', status: 'passed' },
      { id: 'credit-ledger-reconciled', status: creditStatus, detail: creditStatus === 'passed' ? `${credit.creditsDebited} credits, USD ${credit.actualCostUsd}` : 'waiting for the post-run provider ledger balance' },
      { id: 'internal-use-only', status: 'passed' }
    ],
    evidence: [{ kind: 'snapshot', ref: 'repo:/.staging/verifications/appfigures-public-app-reviews/live/snapshot.json', sha256: createHash('sha256').update(await readFile(snapshotPath)).digest('hex') }],
    sideEffects: [{ effect: 'financial', status: 'created', receiptRef: 'repo:/.staging/verifications/appfigures-public-app-reviews/live/snapshot.json#creditReconciliation' }]
  }
  if (!validateReport(report)) throw new Error(`probe report schema mismatch: ${JSON.stringify(validateReport.errors)}`)
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

if (reconcileOnly) {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const creditsAfter = Number(arg('credits-after'))
  const credit = snapshot.creditReconciliation
  if (!Number.isInteger(creditsAfter) || creditsAfter < 0 || !Number.isInteger(credit.creditsBefore) || credit.creditsBefore < creditsAfter) throw new Error('valid --credits-after from the provider ledger is required')
  const creditsDebited = credit.creditsBefore - creditsAfter
  if (creditsDebited < 1 || creditsDebited > snapshot.fixture.maximumCredits) throw new Error(`credit ledger delta ${creditsDebited} is outside the approved range`)
  const actualCostUsd = creditsDebited * credit.creditUnitCostUsd
  if (actualCostUsd > snapshot.fixture.maximumCostUsd) throw new Error(`credit-equivalent cost ${actualCostUsd} exceeds USD ${snapshot.fixture.maximumCostUsd}`)
  snapshot.creditReconciliation = { ...credit, creditsAfter, creditsDebited, actualCostUsd, reconciledAt: new Date().toISOString() }
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  const report = await writeReport({ snapshot, outcome: 'passed', creditStatus: 'passed' })
  console.log(JSON.stringify({ outcome: report.outcome, reviewCount: snapshot.reviews.length, creditsDebited, actualCostUsd, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))
} else {
  if (arg('approve-credits') !== '5') throw new Error('live probe requires --approve-credits=5')
  if (arg('approve-cost-usd') !== '1') throw new Error('live probe requires --approve-cost-usd=1')
  if (arg('approved-use') !== 'internal-research') throw new Error('live probe requires --approved-use=internal-research')
  const creditsBefore = Number(arg('credits-before'))
  const creditUnitCostUsd = Number(arg('credit-unit-cost-usd'))
  if (!Number.isInteger(creditsBefore) || creditsBefore < 5) throw new Error('integer --credits-before provider ledger balance of at least five is required')
  if (!Number.isFinite(creditUnitCostUsd) || creditUnitCostUsd <= 0) throw new Error('--credit-unit-cost-usd from the purchase receipt is required')
  const token = process.env.APPFIGURES_API_TOKEN
  if (!token) throw new Error('approved provider Personal Access Token is unavailable in the runtime environment')

  const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/appfigures-public-app-reviews-probe.json'), 'utf8'))
  const end = new Date()
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - fixture.windowDays + 1))
  const input = {
    store: fixture.target.store,
    appId: fixture.target.appId,
    country: fixture.target.country,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    limit: fixture.limit,
  }
  const startedAt = new Date()
  const result = await readPublicAppReviewSnapshot(input, { credentials: { token } })
  if (result.conformance.status !== 'passed') throw new Error('live review result requires review')
  if (/appfigures|authorization|personal.access.token|has_response/i.test(JSON.stringify(result))) throw new Error('normalized review result leaked hidden execution details')
  const redacted = redactReviewTextForVerification(result)
  if (JSON.stringify(redacted.reviews).includes('"value"')) throw new Error('verification snapshot retained review text')
  const snapshot = {
    schemaVersion: 'dsh.probe-snapshot/appfigures-public-app-reviews/v1',
    fixture,
    startedAt: startedAt.toISOString(),
    creditReconciliation: { creditsBefore, creditsAfter: null, creditsDebited: null, creditUnitCostUsd, actualCostUsd: null, reconciledAt: null },
    ...redacted,
  }
  await mkdir(stageRoot, { recursive: true })
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  const report = await writeReport({ snapshot, outcome: 'partial', creditStatus: 'skipped' })
  console.log(JSON.stringify({ outcome: report.outcome, reviewCount: result.reviews.length, report: reportPath, snapshot: snapshotPath, next: 'Read the post-run provider credit balance, then run the reconcile command with --credits-after=<integer>.' }, null, 2))
}

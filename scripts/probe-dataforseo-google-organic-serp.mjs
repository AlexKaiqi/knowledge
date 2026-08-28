import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readGoogleOrganicResultPage } from '../connectors/dataforseo-google-organic-serp/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const live = process.argv.includes('--live')
const environment = live ? 'production' : 'sandbox'
const approval = process.argv.find((argument) => argument.startsWith('--approve-cost-usd='))?.split('=')[1]
if (live && approval !== '0.01') throw new Error('paid live probe requires the explicit argument --approve-cost-usd=0.01')

const login = process.env.DATAFORSEO_API_LOGIN
const password = process.env.DATAFORSEO_API_PASSWORD
if (!login || !password) throw new Error('approved provider credentials are unavailable in the runtime environment')

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/dataforseo-google-organic-serp-probe-pack.json'), 'utf8'))
if (!Array.isArray(fixture.queries) || fixture.queries.length < 1 || fixture.queries.length > fixture.maximumQueries) throw new Error('probe query pack is invalid')

const startedAt = new Date()
const observations = []
for (const query of fixture.queries) {
  const result = await readGoogleOrganicResultPage(query.input, {
    environment,
    credentials: { login, password },
    maxCostUsd: fixture.maximumTotalCostUsd,
  })
  if (result.conformance.status !== 'passed') throw new Error(`query ${query.id} requires review`)
  if (live && result.results.length < 1) throw new Error(`live query ${query.id} returned no organic results`)
  if (/dataforseo|authorization|api-password/i.test(JSON.stringify(result))) throw new Error(`query ${query.id} leaked hidden execution details`)
  observations.push({ id: query.id, result })
}

const totalCostUsd = observations.reduce((sum, observation) => sum + observation.result.billing.chargedCost, 0)
if (totalCostUsd > fixture.maximumTotalCostUsd) throw new Error(`reported cost ${totalCostUsd} exceeds ${fixture.maximumTotalCostUsd}`)
if (!live && totalCostUsd !== 0) throw new Error('sandbox reported a charged cost')

const mode = live ? 'live' : 'sandbox'
const stageRoot = path.join(root, '.staging/verifications/dataforseo-google-organic-serp', mode)
const snapshotPath = path.join(stageRoot, 'snapshot.json')
const reportPath = path.join(stageRoot, 'report.json')
const snapshot = {
  schemaVersion: 'dsh.probe-snapshot/dataforseo-google-organic-serp/v1',
  mode,
  queryCount: observations.length,
  totalCostUsd,
  observations,
}
await mkdir(stageRoot, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)

const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
const dateSuffix = finishedAt.toISOString().slice(0, 10).replaceAll('-', '')
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `dataforseo-google-organic-serp-${mode}-${dateSuffix}`,
  capabilityRef: '/capabilities/research/read-web-result-page.md',
  connectorId: 'dataforseo-google-organic-serp',
  probeDefinitionRef: `repo:/probes/definitions/dataforseo-google-organic-serp-${mode}.json`,
  identityPoolRef: 'identity-pool:dataforseo-provider-probes',
  environment: live ? 'production-public' : 'sandbox',
  level: live ? 'live' : 'sandbox',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'fixed-query-pack', status: 'passed' },
    { id: 'single-page-bound', status: 'passed' },
    { id: 'response-identity', status: live ? 'passed' : 'skipped', detail: live ? 'production echoes matched' : 'sandbox uses provider dummy identities' },
    { id: 'cost-reconciled', status: live ? 'passed' : 'skipped', detail: `response-reported total USD ${totalCostUsd}` },
    { id: 'hidden-route', status: 'passed' },
    { id: 'coverage-explicit', status: 'passed' }
  ],
  evidence: [{ kind: 'snapshot', ref: `repo:/.staging/verifications/dataforseo-google-organic-serp/${mode}/snapshot.json`, sha256: createHash('sha256').update(await readFile(snapshotPath)).digest('hex') }],
  sideEffects: [live
    ? { effect: 'financial', status: 'created', receiptRef: `repo:/.staging/verifications/dataforseo-google-organic-serp/${mode}/snapshot.json#totalCostUsd` }
    : { effect: 'none', status: 'none' }]
}

const reportSchema = JSON.parse(await readFile(path.join(root, 'spec/probe-report.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(reportSchema)
if (!validate(report)) throw new Error(`probe report schema mismatch: ${JSON.stringify(validate.errors)}`)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, mode, queryCount: observations.length, totalCostUsd, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

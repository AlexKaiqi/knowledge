import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { searchPublicAppCatalog } from '../connectors/apple-public-app-search/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const input = { query: 'ChatGPT', country: 'US', surface: 'iphone', limit: 5 }
const startedAt = new Date()
const result = await searchPublicAppCatalog(input)
if (result.conformance.status !== 'passed') throw new Error('Apple public app search live result requires review')
if (result.items.length < 1 || result.items.length > input.limit) throw new Error('Apple public app search result is outside the requested page bound')
if (!result.items.some((item) => item.appId === '6448311069')) throw new Error('Expected ChatGPT App Store identity was not present in the bounded fixed query')
if (result.coverage.corpusComplete || result.coverage.historical || result.coverage.rankingSemantics !== 'apple-search-api-unspecified' || result.coverage.resultCountSemantics !== 'returned-page-size-only') throw new Error('Apple search coverage boundary changed')
if (result.coverage.metadataOnly !== true || /description|releaseNotes|artwork|credential|authorization|itunes\.apple\.com\/search/i.test(JSON.stringify(result))) throw new Error('Apple public result leaked content or hidden execution details')

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/research/search-public-app-catalog-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`Apple public app search output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/apple/public-app-search/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/apple/public-app-search/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/apple-public-app-search/v1', fixture: { purpose: 'personal-assistant-competitor-discovery', expectedAppId: '6448311069' }, ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `apple-public-app-search-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/research/search-public-app-catalog.md',
  connectorId: 'apple-public-app-search',
  probeDefinitionRef: 'repo:/probes/definitions/apple-public-app-search-live.json',
  environment: 'production-public', level: 'live', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-search-api-live', status: 'passed' },
    { id: 'fixed-query-page-bound', status: 'passed' },
    { id: 'expected-app-identity', status: 'passed' },
    { id: 'ranking-and-count-boundary', status: 'passed' },
    { id: 'metadata-only', status: 'passed' },
    { id: 'hidden-route', status: 'passed' },
    { id: 'output-schema', status: 'passed' }
  ],
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/apple/public-app-search/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, returnedCount: result.items.length, expectedAppPresent: true, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

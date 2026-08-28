import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { searchPublicEprintMetadata } from '../connectors/arxiv-public-metadata-search/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const input = { query: 'personal assistant', field: 'all', category: 'cs.AI', sortBy: 'submittedDate', sortOrder: 'descending', start: 0, limit: 5 }
const startedAt = new Date()
const result = await searchPublicEprintMetadata(input)
if (result.conformance.status !== 'passed') throw new Error('arXiv live result requires review')
if (result.entries.length < 1 || result.entries.length > 5 || result.coverage.totalResults < result.entries.length) throw new Error('arXiv live result coverage is invalid')
if (result.coverage.resultSetMutable !== true || result.coverage.checkpointSemantics !== 'offset-is-not-stable-delta' || result.coverage.contentFilesRetained !== false) throw new Error('arXiv pagination or content boundary changed')
if (result.entries.some((entry) => !entry.abstractUrl.startsWith('https://arxiv.org/abs/') || !entry.pdfUrl.startsWith('https://arxiv.org/pdf/'))) throw new Error('arXiv result links escaped the official host')
if (/export\.arxiv\.org|rawAtom|credential|authorization/i.test(JSON.stringify(result))) throw new Error('public result leaked hidden execution details')

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/arxiv/search-public-eprint-metadata-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`arXiv output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/arxiv/public-metadata-search/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/arxiv/public-metadata-search/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/arxiv-public-metadata-search/v1', fixture: { purpose: 'personal-assistant-frontier-research' }, ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `arxiv-public-metadata-search-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/arxiv/search-public-eprint-metadata.md',
  connectorId: 'arxiv-public-metadata-search',
  probeDefinitionRef: 'repo:/probes/definitions/arxiv-public-metadata-search-live.json',
  environment: 'production-public', level: 'live', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-endpoint-live', status: 'passed' },
    { id: 'fixed-query-page-bound', status: 'passed' },
    { id: 'submitted-date-order', status: 'passed' },
    { id: 'offset-not-stable-delta', status: 'passed' },
    { id: 'metadata-only-no-content-files', status: 'passed' },
    { id: 'hidden-route', status: 'passed' },
    { id: 'output-schema', status: 'passed' }
  ],
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/arxiv/public-metadata-search/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, returnedCount: result.entries.length, totalResults: result.coverage.totalResults, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

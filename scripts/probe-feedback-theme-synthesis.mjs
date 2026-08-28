import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { synthesizeFeedbackThemeEvidence } from '../connectors/feedback-theme-synthesis-agent/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'production-feedback-ledger',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/loop-control.mjs',
    digest: 'c49fdf9df8ac9f08a3560334cc8cedfb6930b13e19cbc51a45f73c058efff6f0',
    semantics: ["await this.store.writeImmutable('feedback-items', feedbackId, feedback)", 'async createReview(input'],
  },
  {
    id: 'production-hypothesis-review',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/spec/hypothesis-review.schema.json',
    digest: '074d959b2c92101c5d56c8727c2b57ce73d4768ec0e157686416278e7ee1e9b0',
    semantics: ['"feedbackIds"', '"verdict": { "enum": ["supported", "mixed", "refuted", "inconclusive"] }'],
  },
]

const startedAt = new Date()
for (const source of sources) {
  const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
}

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/feedback/theme-synthesis.json'), 'utf8'))
const result = await synthesizeFeedbackThemeEvidence(fixture.input, { runAgent: async () => fixture.candidate, now: () => new Date('2026-08-27T03:30:00Z') })
if (result.conformance.status !== 'passed' || result.humanReviewRequired !== true || result.executionAuthorized !== false) throw new Error('theme evidence boundary mismatch')
if (result.themes[0]?.frequency.interpretation !== 'sample-only' || result.themes[0]?.frequency.consideredEvidenceCount !== 4) throw new Error('sample frequency was not independently derived')
if (!result.themes[0]?.counterEvidenceRefs.includes('feedback:3') || !result.unassignedEvidenceRefs.includes('feedback:4')) throw new Error('counterexample or unassigned evidence was lost')
if (JSON.stringify(result).includes('Setup loses the selected device')) throw new Error('output copied feedback statements instead of retaining evidence refs')

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`feedback theme schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/feedback/theme-synthesis/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/feedback/theme-synthesis/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'device-persistence-theme', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `feedback-theme-synthesis-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/synthesize-feedback-theme-evidence.md',
  connectorId: 'feedback-theme-synthesis-agent',
  probeDefinitionRef: 'repo:/probes/definitions/feedback-theme-synthesis-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-feedback-lineage', status: 'passed' },
    { id: 'evidence-reference-integrity', status: 'passed' },
    { id: 'counterexample-and-conflict-retention', status: 'passed' },
    { id: 'sample-only-frequency', status: 'passed' },
    { id: 'unassigned-evidence-retention', status: 'passed' },
    { id: 'human-review-and-non-execution', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'real-agent-l3-quality', status: 'skipped', detail: 'Scripted Agent response validates the contract only; real-Agent quality, recall, stability and multilingual behavior remain unverified.' }
  ],
  evidence: [
    ...sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.digest })),
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/theme-synthesis/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

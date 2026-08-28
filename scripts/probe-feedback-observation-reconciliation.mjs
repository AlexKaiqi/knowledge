import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { reconcileFeedbackObservations } from '../connectors/feedback-observation-reconciler/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'production-feedback-item-contract',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/spec/feedback-item.schema.json',
    digest: '747b925d8cacdb7fdd29d65b13dadc0802053da12687afd4cd32a6b7e029141a',
    semantics: ['platform-local-no-cross-platform-identity', '"externalId": { "type": ["string", "null"] }'],
  },
  {
    id: 'production-feedback-ledger',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/loop-control.mjs',
    digest: 'c49fdf9df8ac9f08a3560334cc8cedfb6930b13e19cbc51a45f73c058efff6f0',
    semantics: ['async recordFeedback(input, { now = new Date() } = {})', "await this.store.writeImmutable('feedback-items', feedbackId, feedback)"],
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

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/feedback/observation-reconciliation.json'), 'utf8'))
const result = reconcileFeedbackObservations(fixture)
const replay = reconcileFeedbackObservations({
  ...fixture,
  priorWindow: { ...fixture.priorWindow, items: [...fixture.priorWindow.items].reverse() },
  currentWindow: { ...fixture.currentWindow, items: [...fixture.currentWindow.items].reverse() },
})
if (result.resultDigest !== replay.resultDigest || JSON.stringify(result) !== JSON.stringify(replay)) throw new Error('reconciliation is not order-stable')
if (result.changes.find((item) => item.itemRef === 'comment:new-edit')?.mutations.join(',') !== 'edited,reply-state-changed') throw new Error('compound mutation mismatch')
if (result.changes.find((item) => item.itemRef === 'comment:deleted')?.mutations[0] !== 'deleted') throw new Error('explicit deletion mismatch')
if (result.missingUnresolved[0]?.deletionInferred !== false || result.deletionInferencePolicy !== 'explicit-lifecycle-only') throw new Error('absence was inferred as deletion')
if (result.executionAuthorized !== false || result.checkpointRecommendation.action !== 'propose-advance') throw new Error('checkpoint or execution boundary mismatch')
const publicKeys = []
function collectKeys(value) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) return value.forEach(collectKeys)
  for (const [key, item] of Object.entries(value)) { publicKeys.push(key); collectKeys(item) }
}
collectKeys(result)
if (publicKeys.some((key) => /^(?:body|author|userId|username|profile|email)$/i.test(key))) throw new Error('public result leaks feedback text or person fields')

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/feedback/reconcile-feedback-observations-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`feedback reconciliation schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/feedback/observation-reconciliation/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/feedback/observation-reconciliation/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'two-window-mutation-set', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `feedback-observation-reconciliation-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/reconcile-feedback-observations.md',
  connectorId: 'feedback-observation-reconciler',
  probeDefinitionRef: 'repo:/probes/definitions/feedback-observation-reconciliation-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-feedback-boundary', status: 'passed' },
    { id: 'new-edit-reply-lifecycle-classification', status: 'passed' },
    { id: 'absence-is-not-deletion', status: 'passed' },
    { id: 'checkpoint-proposal-only', status: 'passed' },
    { id: 'order-stable-replay', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'no-text-or-identity', status: 'passed' }
  ],
  evidence: [
    ...sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.digest })),
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/observation-reconciliation/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

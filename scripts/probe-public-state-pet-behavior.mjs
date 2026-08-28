import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { projectPublicStateToPetBehavior } from '../connectors/public-state-pet-behavior-projector/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/pet/public-state-trace.json'), 'utf8'))
const sourceUrl = 'https://raw.githubusercontent.com/AlexKaiqi/dsh-codex-pet/ddacb3e40385db280930e93d350d3706a8656518/packages/dsh-codex-pet/lib/client.js'
const acceptedSourceDigest = '362d6112e3a2c14edd7077218ebad5a972751edd36de3e09c0a020d5ba5303d3'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const startedAt = new Date()
const sourceResponse = await fetch(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
if (!sourceResponse.ok) throw new Error(`production source unavailable: HTTP_${sourceResponse.status}`)
const sourceBody = Buffer.from(await sourceResponse.arrayBuffer())
if (sha256(sourceBody) !== acceptedSourceDigest) throw new Error('production source digest mismatch')
const sourceText = sourceBody.toString('utf8')
for (const semantic of ['actions.setBase(working ? "running" : "idle")', 'actions.play("failed", 100)', 'actions.play("waiting", 80)', 'actions.play("review", 70)', 'phase === "speaking"', 'phase === "editing"']) {
  if (!sourceText.includes(semantic)) throw new Error(`production source semantic missing: ${semantic}`)
}

const result = projectPublicStateToPetBehavior(fixture)
const repeated = projectPublicStateToPetBehavior(fixture)
if (result.resultDigest !== repeated.resultDigest) throw new Error('projection is not deterministic')
const expectedPulses = [null, 'waiting', 'waving', 'review', 'failed']
if (JSON.stringify(result.decisions.map((item) => item.pulse?.action ?? null)) !== JSON.stringify(expectedPulses)) throw new Error('production edge mapping mismatch')

for (const privateField of ['transcript', 'prompt', 'toolArguments', 'hiddenReasoning']) {
  let rejected = false
  try {
    projectPublicStateToPetBehavior({ trace: [{ kind: 'assistant-state', atMs: 0, available: true, phase: 'speaking', [privateField]: 'private' }] })
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error(`private field was accepted: ${privateField}`)
}

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/pet/project-public-state-to-behavior-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(result)) throw new Error(`projection schema mismatch: ${JSON.stringify(validate.errors)}`)
if (/connector|repository|prompt|credential|internalTrace/i.test(JSON.stringify(result))) throw new Error('public result leaks hidden execution detail')

const snapshotPath = path.join(root, 'knowledge/verifications/pet/public-state-behavior/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/pet/public-state-behavior/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/public-state-pet-behavior/v1', fixture: 'public-state-trace', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `public-state-pet-behavior-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/pet/project-public-state-to-behavior.md',
  connectorId: 'public-state-pet-behavior-projector',
  probeDefinitionRef: 'repo:/probes/definitions/public-state-pet-behavior-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-source-readable', status: 'passed' },
    { id: 'production-source-digest', status: 'passed' },
    { id: 'production-edge-mapping', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'private-surface-rejected', status: 'passed' },
    { id: 'hidden-execution-boundary', status: 'passed' }
  ],
  evidence: [
    { kind: 'artifact', ref: sourceUrl, sha256: acceptedSourceDigest },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/pet/public-state-behavior/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

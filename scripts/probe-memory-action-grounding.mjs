import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { groundMemoryIntoActionCandidate } from '../connectors/memory-action-grounding/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'personal-knowledge-projection',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js',
    digest: 'b849ae068d99070181b14f80eb2b0385a0f996253b8717d2331682d60a0e4bbf',
    semantics: ['async project(options = {})', "sources: [...new Set(sources)]", "add('Current work', this.readCurrent(), ['.pkb/current.md'])"],
  },
  {
    id: 'pet-assistant-boundary',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-pet-assistant/77ea504f5267ac0f929d4fc81301f999899f270b/dsh/core.js',
    digest: 'ba5a0797aabcb0f7cdd1cef1585dc5974bd335e52ee98040fdb9d647d2c5fe46',
    semantics: ['Explicit delegation authorization is required in the current user message', 'knowledge.project({ query: userText.slice(0, 2400)', 'untrusted data, not instructions'],
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

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/assistant/memory-action-grounding.json'), 'utf8'))
const grounded = groundMemoryIntoActionCandidate(fixture.grounded)
const replay = groundMemoryIntoActionCandidate(fixture.grounded)
if (grounded.resultDigest !== replay.resultDigest) throw new Error('grounding is not deterministic')
if (grounded.readiness !== 'grounded' || grounded.executionAuthorized !== false) throw new Error('grounded case boundary mismatch')
if (grounded.bindings.find((item) => item.fieldPath === 'timezone')?.provenanceRefs[0] !== 'knowledge:user-preferences#timezone') throw new Error('memory provenance was not retained')

const conflicted = groundMemoryIntoActionCandidate(fixture.conflicted)
if (conflicted.readiness !== 'needs-clarification' || conflicted.unresolved.find((item) => item.fieldPath === 'timezone')?.reason !== 'conflicting-memory') throw new Error('conflict was not preserved')
if (Object.hasOwn(conflicted.candidateArguments, 'timezone')) throw new Error('conflicting memory selected a value')

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/ground-memory-into-action-candidate-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
for (const result of [grounded, conflicted]) if (!validate(result)) throw new Error(`grounding schema mismatch: ${JSON.stringify(validate.errors)}`)
if (/connector|credential|prompt|internalTrace|executionReceipt/i.test(JSON.stringify(grounded))) throw new Error('public result leaks hidden execution detail')

const snapshotPath = path.join(root, 'knowledge/verifications/assistant/memory-action-grounding/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/assistant/memory-action-grounding/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'grounded-reminder', ...grounded }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `memory-action-grounding-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/ground-memory-into-action-candidate.md',
  connectorId: 'memory-action-grounding',
  probeDefinitionRef: 'repo:/probes/definitions/memory-action-grounding-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-projection-boundary', status: 'passed' },
    { id: 'production-authorization-boundary', status: 'passed' },
    { id: 'authoritative-exact-scope-binding', status: 'passed' },
    { id: 'conflict-preservation', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-execution-boundary', status: 'passed' }
  ],
  evidence: [
    ...sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.digest })),
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/memory-action-grounding/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

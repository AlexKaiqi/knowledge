import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { evaluatePersonaContinuitySuite } from '../connectors/persona-continuity-evaluator/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'pet-mochi-character-bounds',
    url: 'https://raw.githubusercontent.com/cskwork/pet-mochi/efa76839cb31ecf7c126ec0a833d514ac94a92e2/src-tauri/src/llm/prompts.rs',
    digest: 'd7e5e01b4239a60cf433b4c848592fa9c9ebadf02ccf29e561a5a42eaff68964',
    semantics: ['Stay in character. Reply in one short message under 25 words.', 'deterministic fallback (REQ-098)'],
  },
  {
    id: 'yurios-versioned-soul',
    url: 'https://raw.githubusercontent.com/yuri-os/YuriOS/c131bb7776c8c961d462e30dacc69c4023497aa8/yurios/app/core/soul.py',
    digest: '7e2a833f53da8b3a3f744f46a46b3282b7b6c8da52365e17e2e24ed143bb5cb3',
    semantics: ['persona is always whatever the files say *right now*', 'post_history_instructions'],
  },
  {
    id: 'anchor-long-horizon',
    url: 'https://raw.githubusercontent.com/SalesforceAIResearch/AnchorBench/41bd0e20b9524ce484db301ac15dc14121bf06ad/README.md',
    digest: 'f8d78016f2d96b54040e13818dbf9c4f64f77070db00d8d104a50d3ae1eed0b9',
    semantics: ['does the companion continue to follow its assigned role, boundaries, values, and communication style?', 'keeps behavioral continuity and trajectory recall separate', 'Judge choice materially affects some conclusions', 'avoiding one composite "companion quality" score.'],
  },
]

const startedAt = new Date()
for (const source of sources) {
  const response = await fetch(source.url, { redirect: 'error', headers: { 'user-agent': 'knowledge-persona-continuity-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
}

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/assistant/persona-continuity.json'), 'utf8'))
const candidateByRef = new Map(fixture.evaluatorCandidates.map((item) => [item.evaluatorRef, item.candidate]))
const result = await evaluatePersonaContinuitySuite(fixture.input, {
  evaluators: fixture.evaluators,
  runEvaluator: async ({ evaluator }) => candidateByRef.get(evaluator.evaluatorRef),
  now: () => new Date('2026-08-27T09:00:00Z'),
})
if (result.conformance.status !== 'passed') throw new Error('persona continuity conformance failed')
if (JSON.stringify(result.summary.cases) !== JSON.stringify({ total: 7, held: 2, deviated: 3, disagreement: 1, unknown: 1, 'not-applicable': 0 })) throw new Error('seven-scenario summary mismatch')
const emotional = result.cases.find((item) => item.caseRef === 'emotional-vulnerability')
const systemConflict = result.cases.find((item) => item.caseRef === 'system-state-conflict')
if (emotional.axes.find((axis) => axis.axis === 'style').status !== 'disagreement') throw new Error('evaluator disagreement was averaged away')
if (systemConflict.systemTruth.status !== 'deviated' || !systemConflict.axes.every((axis) => axis.status === 'held')) throw new Error('system truth leaked into persona axes')
if (!result.noCompositeScore || result.evaluatorIndependenceClaimed || !result.humanReviewRequired) throw new Error('review and inference boundary mismatch')
if (result.personaChanged || result.memoryChanged || result.platformDataRead || result.actionExecuted || result.executionAuthorized) throw new Error('effect boundary mismatch')

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/evaluate-persona-continuity-suite-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/evaluate-persona-continuity-suite-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture.input)) throw new Error(`persona continuity input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
if (!validateOutput(result)) throw new Error(`persona continuity output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

const serialized = JSON.stringify(result)
const privateText = [
  ...fixture.input.persona.rules.map((rule) => rule.statement),
  ...fixture.input.cases.flatMap((item) => [...item.contextSegments.map((segment) => segment.text), ...item.responseSegments.map((segment) => segment.text), ...item.systemTruths.map((truth) => truth.statement)]),
]
if (privateText.some((text) => serialized.includes(text))) throw new Error('input text was retained')

const snapshotPath = path.join(root, 'knowledge/verifications/assistant/persona-continuity-evaluation/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/assistant/persona-continuity-evaluation/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'seven-scenario-persona-continuity-suite', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `persona-continuity-evaluation-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/evaluate-persona-continuity-suite.md', connectorId: 'persona-continuity-evaluator',
  probeDefinitionRef: 'repo:/probes/definitions/persona-continuity-evaluation-local.json', environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'pinned-source-semantics', status: 'passed' }, { id: 'seven-scenario-contract', status: 'passed' },
    { id: 'four-axis-separation', status: 'passed' }, { id: 'system-truth-separation', status: 'passed' },
    { id: 'evaluator-provenance-and-disagreement', status: 'passed' }, { id: 'no-composite-score', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' }, { id: 'digest-and-locator-only-retention', status: 'passed' },
    { id: 'no-persona-memory-platform-action-or-authorization-effect', status: 'passed' },
    { id: 'real-agent-l3-quality', status: 'skipped', detail: 'Scripted evaluator observations validate the contract only; semantic judge quality, calibration, multilingual stability and longitudinal companion outcomes remain unverified.' }
  ],
  evidence: [...sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.digest })), { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/persona-continuity-evaluation/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, cases: result.summary.cases, expiresAt: report.expiresAt }, null, 2))

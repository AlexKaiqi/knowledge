import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { evaluateVersionedMemoryUseSuite } from '../connectors/versioned-memory-use-evaluator/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normalizeHtmlText = (value) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ').trim()
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/assistant/versioned-memory-use-suite.json'), 'utf8'))
const sources = [
  { id: 'evermem', url: 'https://arxiv.org/html/2602.01313', assertions: ['version semantics, not just timestamps', 'similarity-based retrieval struggles to surface implicitly relevant information'] },
  { id: 'longmemeval', url: 'https://arxiv.org/html/2410.10813', assertions: ['Knowledge Updates (KU): Ability to recognize the changes in the user’s personal information', 'Abstention (ABS): Ability to identify questions seeking unknown information'] },
  { id: 'mem2act', url: 'https://arxiv.org/html/2601.19935', assertions: ['persistent bottlenecks in memory retrieval and parameter grounding', '400 memory-dependent tool-use tasks derived from 2,029 long-context dialogue sessions'] },
  { id: 'ifcmemorybench', url: 'https://arxiv.org/html/2607.26072', assertions: ['often retrieve topically relevant context but store project knowledge as incomplete or fragmented facts', 'deployment-realistic ingestion scope'] }
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-versioned-memory-eval-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = normalizeHtmlText(body.toString('utf8'))
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/evaluate-versioned-memory-use-suite-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/evaluate-versioned-memory-use-suite-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`versioned memory input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = evaluateVersionedMemoryUseSuite(fixture)
const reordered = structuredClone(fixture)
reordered.cases.reverse()
for (const item of reordered.cases) {
  item.memories.reverse()
  item.observed.ingestedMemoryRefs.reverse()
  item.observed.retrievedMemoryRefs.reverse()
  item.observed.selectedMemoryRefs.reverse()
}
const replay = evaluateVersionedMemoryUseSuite(reordered)
if (prepared.status !== 'passed' || prepared.summary.caseCount !== 10 || prepared.summary.passedCases !== 10 || prepared.resultDigest !== replay.resultDigest) throw new Error('deterministic ten-case replay failed')
if (!validateOutput(prepared)) throw new Error(`versioned memory output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.cases.every((item) => item.stages.length === 5 && item.stages.every((stage) => stage.status === 'passed'))) throw new Error('passing stage matrix mismatch')

const stale = structuredClone(fixture)
const temporal = stale.cases.find((item) => item.caseRef === 'case:temporal-supersession')
temporal.observed.retrievedMemoryRefs = ['memory:address-old']
temporal.observed.selectedMemoryRefs = ['memory:address-old']
temporal.observed.fields = [{ fieldRef: 'field:address', valueDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', evidenceRefs: ['memory:address-old'] }]
const staleResult = evaluateVersionedMemoryUseSuite(stale).cases.find((item) => item.caseRef === 'case:temporal-supersession')
if (staleResult.stages.find((stage) => stage.id === 'ingestion-coverage').status !== 'passed') throw new Error('stale mutation incorrectly failed ingestion')
for (const stage of ['retrieval-precision-and-coverage', 'version-and-scope-resolution', 'evidence-grounded-utilization']) if (staleResult.stages.find((item) => item.id === stage).status !== 'failed') throw new Error(`stale mutation did not fail ${stage}`)

const scopeLeak = structuredClone(fixture)
const scoped = scopeLeak.cases.find((item) => item.caseRef === 'case:scope-isolation')
scoped.observed.ingestedMemoryRefs.push('memory:other-language')
scoped.observed.retrievedMemoryRefs.push('memory:other-language')
const scopeResult = evaluateVersionedMemoryUseSuite(scopeLeak).cases.find((item) => item.caseRef === 'case:scope-isolation')
if (scopeResult.stages[0].status !== 'failed' || scopeResult.stages[1].status !== 'failed') throw new Error('scope leakage was not attributed')

const hallucinated = structuredClone(fixture)
const missing = hallucinated.cases.find((item) => item.caseRef === 'case:missing-required-fact')
missing.observed.decision = 'action-candidate'
missing.observed.fields = [{ fieldRef: 'field:recipient', valueDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', evidenceRefs: ['inference:unsupported'] }]
const hallucinatedResult = evaluateVersionedMemoryUseSuite(hallucinated).cases.find((item) => item.caseRef === 'case:missing-required-fact')
if (hallucinatedResult.stages[3].status !== 'failed' || hallucinatedResult.stages[4].status !== 'failed') throw new Error('unsupported autofill was not separated')

const mutation = structuredClone(fixture)
const preference = mutation.cases.find((item) => item.caseRef === 'case:confirmed-preference')
preference.memories[0].valueDigest = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
preference.observed.fields[0].valueDigest = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
const mutated = evaluateVersionedMemoryUseSuite(mutation)
if (mutated.status !== 'passed' || mutated.resultDigest === prepared.resultDigest) throw new Error('memory semantic mutation was not bound')
if (prepared.memoryChanged || prepared.knowledgeWritten || prepared.actionExecuted || prepared.executionAuthorized) throw new Error('effect boundary mismatch')

const snapshotPath = path.join(root, 'knowledge/verifications/assistant/versioned-memory-use-evaluation/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/assistant/versioned-memory-use-evaluation/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'ten-case-versioned-memory-use-suite', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `versioned-memory-use-evaluation-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/evaluate-versioned-memory-use-suite.md', connectorId: 'versioned-memory-use-evaluator',
  probeDefinitionRef: 'repo:/probes/definitions/versioned-memory-use-evaluation-local.json', environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-memory-evaluation-research-semantics', status: 'passed' }, { id: 'ten-case-suite', status: 'passed' },
    { id: 'deterministic-replay-and-order-independence', status: 'passed' }, { id: 'semantic-mutation-binding', status: 'passed' },
    { id: 'stage-specific-failure-attribution', status: 'passed' }, { id: 'scope-leakage-attribution', status: 'passed' },
    { id: 'unknown-abstention-and-ask', status: 'passed' }, { id: 'input-output-schema', status: 'passed' },
    { id: 'opaque-digest-only-surface', status: 'passed' }, { id: 'no-memory-knowledge-or-action-effect', status: 'passed' }
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/versioned-memory-use-evaluation/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, cases: prepared.summary.caseCount, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

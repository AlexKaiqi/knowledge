import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { observeMultiTurnResponseRepetition } from '../connectors/multi-turn-response-repetition-observer/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const catalog = JSON.parse(await readFile(path.join(root, 'collectors/multi-turn-response-repetition-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()

for (const source of catalog.sources) {
  const response = await fetch(source.url, { redirect: 'error', headers: { 'user-agent': 'knowledge-response-repetition-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== source.acceptedDocumentDigest) throw new Error(`${source.id} digest mismatch`)
  const content = body.toString('utf8')
  for (const assertion of source.observation.assertions) if (!content.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
}

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/assistant/multi-turn-response-repetition.json'), 'utf8'))
const result = observeMultiTurnResponseRepetition(fixture, { now: () => new Date('2026-08-27T10:00:00Z') })
if (result.conformance.status !== 'passed') throw new Error('response repetition conformance failed')
if (result.summary.caseCount !== 2 || result.summary.responseCount !== 9) throw new Error('multilingual fixture coverage mismatch')
if (result.summary.exactRepeatPairCount !== 3 || result.summary.contextualizedExactRepeatPairCount !== 2 || result.summary.uncontextualizedExactRepeatPairCount !== 1) throw new Error('exact repeat context accounting mismatch')
if (result.summary.bigram.repeated < 1 || result.summary.trigram.repeated < 1) throw new Error('n-gram overlap was not observed')
const short = result.cases.find((item) => item.caseRef === 'english-planning').observations.find((item) => item.responseRef === 'turn-six')
if (short.bigram.status !== 'unavailable' || short.trigram.status !== 'unavailable') throw new Error('short response availability boundary mismatch')
if (result.policy.thresholdsApplied || Object.hasOwn(result, 'score') || result.interpretation.semanticRepetitionEvaluated || result.interpretation.responseQualityInferred || result.interpretation.personaContinuityInferred || result.interpretation.companionshipOutcomeInferred) throw new Error('metric inference boundary mismatch')
if (!result.interpretation.humanReviewRequired || !result.interpretation.declaredContextsAreCallerClaims) throw new Error('review or context provenance boundary mismatch')
if (result.personaChanged || result.memoryChanged || result.platformDataRead || result.actionExecuted || result.executionAuthorized) throw new Error('effect boundary mismatch')

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/observe-multi-turn-response-repetition-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/observe-multi-turn-response-repetition-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`response repetition input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
if (!validateOutput(result)) throw new Error(`response repetition output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

const serialized = JSON.stringify(result)
if (fixture.cases.flatMap((item) => item.responses.map((response) => response.text)).some((value) => serialized.includes(value))) throw new Error('input text was retained')

const snapshotPath = path.join(root, 'knowledge/verifications/assistant/multi-turn-response-repetition/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/assistant/multi-turn-response-repetition/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'multilingual-multi-turn-response-repetition-suite', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `multi-turn-response-repetition-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/observe-multi-turn-response-repetition.md', connectorId: 'multi-turn-response-repetition-observer',
  probeDefinitionRef: 'repo:/probes/definitions/multi-turn-response-repetition-local.json', environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'pinned-source-semantics', status: 'passed' }, { id: 'multilingual-exact-and-ngram-observation', status: 'passed' },
    { id: 'context-provenance-without-count-erasure', status: 'passed' }, { id: 'short-response-unavailable-state', status: 'passed' },
    { id: 'no-threshold-or-quality-score', status: 'passed' }, { id: 'input-output-schema', status: 'passed' },
    { id: 'digest-locator-and-count-only-retention', status: 'passed' }, { id: 'no-persona-memory-platform-action-or-authorization-effect', status: 'passed' },
    { id: 'semantic-repetition-and-longitudinal-outcomes', status: 'skipped', detail: 'Lexical overlap does not prove semantic repetition, response quality, persona continuity or longitudinal companion outcomes.' }
  ],
  evidence: [...catalog.sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.acceptedDocumentDigest })), { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/multi-turn-response-repetition/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, exactRepeatPairs: result.summary.exactRepeatPairCount, expiresAt: report.expiresAt }, null, 2))

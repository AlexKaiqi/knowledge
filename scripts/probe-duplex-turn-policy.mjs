import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { projectDuplexTurnEventsToActions } from '../connectors/duplex-turn-policy-projector/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/voice/duplex-turn-trace.json'), 'utf8'))
const sourceUrl = 'https://raw.githubusercontent.com/AlexKaiqi/dsh-realtime-voice/1cfddba6ad39d4b8ef075b66870ab533068a7d78/client/client.js'
const sourceDigest = 'f5055565a4df7d95a6fc5b5afc8414e57f071f7fe846e659a2159175dba8af25'
const issueUrl = 'https://github.com/huggingface/speech-to-speech/issues/433'
const benchmarkUrl = 'https://arxiv.org/abs/2607.20460'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fetchBytes = async (url) => {
  const response = await fetch(url, { redirect: 'error', headers: { 'user-agent': 'knowledge-catalog-probe' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`public source unavailable: HTTP_${response.status} ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

const startedAt = new Date()
const productionBody = await fetchBytes(sourceUrl)
if (sha256(productionBody) !== sourceDigest) throw new Error('production client digest mismatch')
const productionText = productionBody.toString('utf8')
for (const semantic of ["event.type === 'input_audio_buffer.speech_started'", 'handle.cancelPlayback()', "type: 'response.cancel'", "type: 'interrupted'"]) {
  if (!productionText.includes(semantic)) throw new Error(`production cancellation semantic missing: ${semantic}`)
}

const issueBody = await fetchBytes(issueUrl)
const issueText = issueBody.toString('utf8')
for (const semantic of ['default min_speech_ms=384', 'short noise bursts would become real conversation turns', 'A false candidate restores normal output without losing buffered audio.']) {
  if (!issueText.includes(semantic)) throw new Error(`problem evidence semantic missing: ${semantic}`)
}
const benchmarkBody = await fetchBytes(benchmarkUrl)
const benchmarkText = benchmarkBody.toString('utf8')
for (const semantic of ['best model achieves only 64.4% adherence', 'backchanneling and interruption remaining particularly challenging']) {
  if (!benchmarkText.includes(semantic)) throw new Error(`benchmark semantic missing: ${semantic}`)
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/voice/project-duplex-turn-events-to-actions-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/voice/project-duplex-turn-events-to-actions-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
if (!ajv.compile(inputSchema)(fixture)) throw new Error('fixture does not match public input schema')

const result = projectDuplexTurnEventsToActions(fixture)
const repeated = projectDuplexTurnEventsToActions(fixture)
if (result.resultDigest !== repeated.resultDigest) throw new Error('projection is not deterministic')
if (!ajv.compile(outputSchema)(result)) throw new Error('result does not match public output schema')
const actionTypes = result.decisions.flatMap((decision) => decision.actions.map((action) => action.type))
if (actionTypes.filter((type) => type === 'cancel-output').length !== 1) throw new Error('only the confirmed turn-take may cancel output')
if (JSON.stringify(actionTypes) !== JSON.stringify(['duck-output', 'restore-output', 'duck-output', 'restore-output', 'record-backchannel', 'duck-output', 'cancel-output', 'open-user-turn', 'commit-user-turn'])) throw new Error('turn action plan mismatch')

for (const privateField of ['rawAudio', 'transcript', 'prompt', 'providerEvent']) {
  let rejected = false
  try {
    projectDuplexTurnEventsToActions({ trace: [{ kind: 'assistant-output', atMs: 0, state: 'started', [privateField]: 'private' }] })
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error(`private field was accepted: ${privateField}`)
}
if (/connector|repository|credential|internalTrace|providerWire/i.test(JSON.stringify(result))) throw new Error('public result leaks hidden execution detail')

const snapshotPath = path.join(root, 'knowledge/verifications/voice/duplex-turn-policy/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/voice/duplex-turn-policy/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/duplex-turn-policy/v1', fixture: 'duplex-turn-trace', ...result }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `duplex-turn-policy-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/voice/project-duplex-turn-events-to-actions.md',
  connectorId: 'duplex-turn-policy-projector',
  probeDefinitionRef: 'repo:/probes/definitions/duplex-turn-policy-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-source-readable', status: 'passed' },
    { id: 'production-source-digest', status: 'passed' },
    { id: 'production-direct-cancel-observed', status: 'passed' },
    { id: 'problem-evidence-semantics', status: 'passed' },
    { id: 'benchmark-semantics', status: 'passed' },
    { id: 'reversible-release', status: 'passed' },
    { id: 'backchannel-preserves-output', status: 'passed' },
    { id: 'confirmed-take-turn-only-cancel', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'private-surface-rejected', status: 'passed' },
    { id: 'hidden-execution-boundary', status: 'passed' }
  ],
  evidence: [
    { kind: 'artifact', ref: sourceUrl, sha256: sourceDigest },
    { kind: 'artifact', ref: issueUrl, sha256: sha256(issueBody) },
    { kind: 'artifact', ref: benchmarkUrl, sha256: sha256(benchmarkBody) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/voice/duplex-turn-policy/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, checks: report.checks.length, expiresAt: report.expiresAt }, null, 2))

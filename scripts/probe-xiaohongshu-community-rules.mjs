import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readCommunityRuleSurface } from '../connectors/xiaohongshu-community-rules-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/xiaohongshu-community-rules')
const observationPath = process.env.KNOWLEDGE_XHS_COMMUNITY_RULES_OBSERVATION ?? path.join(outputRoot, 'rendered-observation.json')

function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n` }

const startedAt = new Date()
const observation = JSON.parse(await readFile(observationPath, 'utf8'))
const result = readCommunityRuleSurface(observation)
const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/xiaohongshu/community-rule-surface-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv)
const validate = ajv.compile(schema)
const schemaValid = validate(result)
const finishedAt = new Date()
const snapshot = { schemaVersion: 'dsh.xiaohongshu-community-rule-snapshot/v1', ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'output-schema-valid', status: schemaValid ? 'passed' : 'failed' },
  { id: 'normalized-evidence-only', status: JSON.stringify(result).includes('<') ? 'failed' : 'passed' },
]
const outcome = checks.every((check) => check.status === 'passed') ? 'passed' : 'failed'
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `xiaohongshu-community-rules-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/xiaohongshu/read-community-rule-surface.md',
  connectorId: 'xiaohongshu-community-rules-browser',
  probeDefinitionRef: 'repo:/probes/definitions/xiaohongshu-community-rules-live.json',
  environment: 'production-public', level: 'live', outcome,
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/xiaohongshu/community-rules/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true, mode: 0o700 })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText, { mode: 0o600 }),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report), { mode: 0o600 }),
])
process.stdout.write(stableJson({ outcome, semanticDigest: result.semanticDigest, snapshotSha256: snapshotDigest, outputRoot }))
if (outcome !== 'passed') process.exitCode = 1

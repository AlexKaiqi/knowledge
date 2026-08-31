import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { auditStoreAiReadiness } from '../connectors/optifeed-radar-ai-readiness/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/optifeed-radar-ai-readiness')
const radarRoot = path.resolve(process.env.OPTIFEED_RADAR_ROOT ?? path.join(repositoryRoot, '.runtime/optifeed-radar'))
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const replayStaged = process.argv.includes('--replay-staged')
let startedAt
let finishedAt
let result

if (replayStaged) {
  const [snapshot, priorReport] = await Promise.all([
    readFile(path.join(outputRoot, 'snapshot.json'), 'utf8').then(JSON.parse),
    readFile(path.join(outputRoot, 'report.json'), 'utf8').then(JSON.parse),
  ])
  const { schemaVersion, fixture, ...storedResult } = snapshot
  if (schemaVersion !== 'dsh.optifeed-radar-ai-readiness-snapshot/v1' || fixture?.domain !== 'optifeed.com') throw new Error('staged Radar evidence does not match the fixed fixture')
  startedAt = new Date(priorReport.startedAt)
  finishedAt = new Date(priorReport.finishedAt)
  result = storedResult
} else {
  startedAt = new Date()
  result = await auditStoreAiReadiness({ domain: 'optifeed.com' }, { radarRoot })
  finishedAt = new Date()
}

const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/distribution/audit-store-ai-readiness-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const schemaValid = ajv.compile(schema)(result)
const categoryWeights = result.categories.reduce((sum, category) => sum + category.weight, 0)
const noSecretOrRuntimeFields = !/(api[_-]?key|credential|token|radarRoot|\/Users\/|acceptedCommit)/i.test(JSON.stringify(result))
const exactFixture = result.domain === 'optifeed.com'
const zeroCost = result.measurement.aiEngineCalls === false && result.measurement.apiCost === 0
const honestScope = result.measurement.recommendationVisibilityMeasured === false && result.readiness.scoreKind === 'site-ai-readiness'
const probePassed = result.conformance.status === 'passed' && schemaValid && categoryWeights === 100 && noSecretOrRuntimeFields && exactFixture && zeroCost && honestScope
const snapshot = { schemaVersion: 'dsh.optifeed-radar-ai-readiness-snapshot/v1', fixture: { domain: 'optifeed.com' }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'public-output-schema', status: schemaValid ? 'passed' : 'failed' },
  { id: 'fixture-domain', status: exactFixture ? 'passed' : 'failed' },
  { id: 'zero-financial-effect', status: zeroCost ? 'passed' : 'failed' },
  { id: 'readiness-not-visibility', status: honestScope ? 'passed' : 'failed' },
  { id: 'secret-and-runtime-minimization', status: noSecretOrRuntimeFields ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `optifeed-radar-ai-readiness-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/distribution/audit-store-ai-readiness.md',
  connectorId: 'optifeed-radar-ai-readiness',
  probeDefinitionRef: 'repo:/probes/definitions/optifeed-radar-ai-readiness-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/distribution/ai-readiness-audit/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}

await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({
  outcome: report.outcome,
  domain: result.domain,
  readinessScore: result.readiness.score,
  categoryCount: result.categories.length,
  crawlerCount: result.crawlerAccess.length,
  aiEngineCalls: result.measurement.aiEngineCalls,
  apiCost: result.measurement.apiCost,
  snapshotSha256: snapshotDigest,
  evidenceMode: replayStaged ? 'offline-recheck-of-staged-live-response' : 'live-request-through-reviewed-local-clone',
  outputRoot,
}))
if (!probePassed) process.exitCode = 1

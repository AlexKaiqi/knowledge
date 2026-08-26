import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicModelRevisionManifest } from '../connectors/hugging-face-public-model-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/hugging-face-public-model-revision')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { repoId: 'openai-community/gpt2', commitSha: '607a30d783dfa663caf39e06633721c8d4cfcd7e' }
const expected = {
  pipelineTag: 'text-generation',
  libraryName: 'transformers',
  requiredTags: ['license:mit', 'text-generation', 'transformers'],
  fileCount: 26,
  totalSizeBytes: 5632417295,
  fileManifestDigest: '422ae0580bb10610675f2c248cd65f34bc9425c42ca6d4c0fa31226d05ef09bb',
  files: {
    'README.md': { sizeBytes: 8092, gitBlobSha1: 'a16a55fda99d2f2e7b69cce5cf93ff4ad3049930', lfsSha256: null },
    'config.json': { sizeBytes: 665, gitBlobSha1: '10c66461e4c109db5a2196bff4bb59be30396ed8', lfsSha256: null },
    'model.safetensors': { sizeBytes: 548105171, gitBlobSha1: '44b36d6e32d13c8fb28b0feab0ac8bfefa7efeda', lfsSha256: '248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707' },
  },
}

const startedAt = new Date()
const result = await readPublicModelRevisionManifest(fixtureInput)
const finishedAt = new Date()
const revision = result.modelRevision
const identityMatched = revision.repoId === fixtureInput.repoId && revision.commitSha === fixtureInput.commitSha && revision.visibility === 'public' && !revision.gated && !revision.disabled
const classificationMatched = revision.pipelineTag === expected.pipelineTag && revision.libraryName === expected.libraryName && expected.requiredTags.every((tag) => revision.tags.includes(tag))
const manifestMatched = revision.manifestComplete
  && revision.fileCount === expected.fileCount
  && revision.totalSizeBytes === expected.totalSizeBytes
  && revision.fileManifestDigest === expected.fileManifestDigest
  && Object.entries(expected.files).every(([filePath, fileExpected]) => {
    const file = revision.files.find((candidate) => candidate.path === filePath)
    return file && file.sizeBytes === fileExpected.sizeBytes && file.gitBlobSha1 === fileExpected.gitBlobSha1 && file.lfsSha256 === fileExpected.lfsSha256
  })
const serialized = JSON.stringify(result)
const minimized = !/(?:"author"|"downloads"|"likes"|"spaces"|widgetData|cardData|request[_-]?id|authorization|hf_token|"raw")/i.test(serialized)
const probePassed = result.conformance.status === 'passed' && identityMatched && classificationMatched && manifestMatched && minimized
const snapshot = { schemaVersion: 'dsh.hugging-face-public-model-revision-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-classification', status: classificationMatched ? 'passed' : 'failed' },
  { id: 'fixture-file-manifest', status: manifestMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `hugging-face-public-model-revision-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/hugging-face/read-public-model-revision-manifest.md',
  connectorId: 'hugging-face-public-model-revision',
  probeDefinitionRef: 'repo:/probes/definitions/hugging-face-public-model-revision-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/hugging-face/public-model-revision/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, repoId: revision.repoId, commitSha: revision.commitSha, fileCount: revision.fileCount, totalSizeBytes: revision.totalSizeBytes, fileManifestDigest: revision.fileManifestDigest, rateLimit: result.rateLimit, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicJarReleaseEvidence } from '../connectors/maven-central-public-jar-release/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/maven-central-public-jar-release')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { groupId: 'junit', artifactId: 'junit', version: '4.13.2' }
const expected = {
  gav: 'junit:junit:4.13.2',
  packaging: 'jar',
  repositoryPath: 'junit/junit/4.13.2',
  totalPayloadBytes: 412432,
  files: {
    pom: { fileName: 'junit-4.13.2.pom', sizeBytes: 27018, sha1: '73bc5be628edeb297a1caf421a5a2e494798b92f', sha256: '569b6977ee4603c965c1c46c3058fa6e969291b0160eb6964dd092cd89eadd94' },
    jar: { fileName: 'junit-4.13.2.jar', sizeBytes: 384581, sha1: '8ac9e16d933b6fb43bc7f576336b8f4d7eb5ba12', sha256: '8e495b634469d64fb8acfa3495a065cbacc8a0fff55ce1e31007be4c16dc57d3' },
    'jar-signature': { fileName: 'junit-4.13.2.jar.asc', sizeBytes: 833, sha1: '1f46809508470e369a44edc6bc3f07d59f378845', sha256: 'a8538f87f58b6f54b7a6ceffd01262b082c389622b0886c520878de1efb9eab9' },
  },
}

const startedAt = new Date()
const result = await readPublicJarReleaseEvidence(fixtureInput)
const finishedAt = new Date()
const release = result.release
const identityMatched = release.gav === expected.gav && release.packaging === expected.packaging && release.repositoryPath === expected.repositoryPath && release.pomCoordinatesVerified
const filesMatched = release.fileCount === 3 && release.totalPayloadBytes === expected.totalPayloadBytes && Object.entries(expected.files).every(([role, fileExpected]) => {
  const file = release.files.find((candidate) => candidate.role === role)
  return file && file.fileName === fileExpected.fileName && file.sizeBytes === fileExpected.sizeBytes && file.sha1 === fileExpected.sha1 && file.sha256 === fileExpected.sha256
})
const signatureBoundary = release.signaturePresent && !release.signatureCryptographicallyVerified && release.files.find((file) => file.role === 'jar-signature')?.checksumSource === 'local-only'
const minimized = !/(developers|contributors|private person|@(?:gmail|google|junit|example)|rawPayload|authorization|cookie|token)/i.test(JSON.stringify(result))
const executionBoundary = result.access.authentication === 'none' && result.access.httpGetCount === 5 && result.access.checksumSidecarCount === 2 && !result.access.filesExecuted
const probePassed = result.conformance.status === 'passed' && identityMatched && filesMatched && signatureBoundary && minimized && executionBoundary
const snapshot = { schemaVersion: 'dsh.maven-central-public-jar-release-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-gav-and-pom', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-file-integrity', status: filesMatched ? 'passed' : 'failed' },
  { id: 'signature-verification-boundary', status: signatureBoundary ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
  { id: 'no-install-or-execution', status: executionBoundary ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `maven-central-public-jar-release-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/maven-central/read-public-jar-release-evidence.md',
  connectorId: 'maven-central-public-jar-release',
  probeDefinitionRef: 'repo:/probes/definitions/maven-central-public-jar-release-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/maven-central/public-jar-release/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, gav: release.gav, fileCount: release.fileCount, totalPayloadBytes: release.totalPayloadBytes, files: release.files.map(({ role, sizeBytes, sha1, sha256, checksumSource }) => ({ role, sizeBytes, sha1, sha256, checksumSource })), snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

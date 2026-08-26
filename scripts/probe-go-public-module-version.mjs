import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readAuthenticatedPublicModuleVersion } from '../connectors/go-public-module-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/go-public-module-version')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { modulePath: 'rsc.io/quote', version: 'v1.5.2', publicModuleAcknowledged: true }
const redirectFixtureInput = { modulePath: 'k8s.io/kubernetes', version: 'v1.34.0', publicModuleAcknowledged: true }
const expected = {
  publishedAt: '2018-02-14T15:44:20.000Z',
  archiveSizeBytes: 2987,
  moduleTreeH1: 'h1:w5fcysjrx7yqtD/aO+QwRjYZOKnaM9Uh2b40tElTs3Y=',
  goModSha256: 'b167e79090d79e4b5738995c62a2186548fc33c919d6b4da1d36cc8c7c1e40c1',
  goModH1: 'h1:LzX7hefJvL54yjefDEDHNONDjII0t9xZLPXsUe+TKr0=',
}
const redirectExpected = {
  publishedAt: '2025-08-27T10:09:04.000Z',
  archiveSizeBytes: 21394229,
  moduleTreeH1: 'h1:NvUrwPAVB4W3mSOpJ/RtNGHWWYyUP/xPaX5rUSpzA0w=',
  goModSha256: '0adb0cd6053674567908c72ab26a5fe39370b29afb6859ab0ebd905c665f4a3d',
  goModH1: 'h1:iu+FhII+Oc/1gGWLJcer6wpyih441aNFHl7Pvm8yPto=',
}

const startedAt = new Date()
const result = await readAuthenticatedPublicModuleVersion(fixtureInput)
const redirectResult = await readAuthenticatedPublicModuleVersion(redirectFixtureInput, { timeoutMs: 60_000 })
const finishedAt = new Date()
const identityMatched = result.moduleVersion.modulePath === fixtureInput.modulePath && result.moduleVersion.version === fixtureInput.version
const metadataMatched = result.moduleVersion.publishedAt === expected.publishedAt
  && result.transfer.archiveSizeBytes === expected.archiveSizeBytes
const authenticationMatched = result.authentication.status === 'authenticated'
  && result.authentication.checksumDatabase === 'sum.golang.org'
  && result.moduleVersion.moduleTreeH1 === expected.moduleTreeH1
  && result.moduleVersion.goMod.sha256 === expected.goModSha256
  && result.moduleVersion.goMod.h1 === expected.goModH1
const isolationMatched = result.transfer.archiveDownloaded === true
  && result.transfer.archiveExecuted === false
  && result.transfer.cacheScope === 'ephemeral'
  && result.transfer.cacheRemoved === true
const redirectMatched = redirectResult.conformance.status === 'passed'
  && redirectResult.moduleVersion.modulePath === redirectFixtureInput.modulePath
  && redirectResult.moduleVersion.version === redirectFixtureInput.version
  && redirectResult.moduleVersion.publishedAt === redirectExpected.publishedAt
  && redirectResult.moduleVersion.moduleTreeH1 === redirectExpected.moduleTreeH1
  && redirectResult.moduleVersion.goMod.sha256 === redirectExpected.goModSha256
  && redirectResult.moduleVersion.goMod.h1 === redirectExpected.goModH1
  && redirectResult.transfer.archiveSizeBytes === redirectExpected.archiveSizeBytes
  && redirectResult.transfer.delivery === 'official-storage-redirect'
  && redirectResult.transfer.archiveExecuted === false
  && redirectResult.transfer.cacheRemoved === true
const serializedResult = JSON.stringify([result, redirectResult])
const minimized = !/(?:\/tmp\/|module-cache|"Info"|"GoMod"|"Zip"|"Dir")/.test(serializedResult)
  && !/(?:cookie|token|credential|GoogleAccessId|Signature=)/i.test(serializedResult)
const probePassed = result.conformance.status === 'passed' && identityMatched && metadataMatched && authenticationMatched && isolationMatched && redirectMatched && minimized
const redirectObservation = {
  request: redirectResult.request,
  publishedAt: redirectResult.moduleVersion.publishedAt,
  moduleTreeH1: redirectResult.moduleVersion.moduleTreeH1,
  goModSha256: redirectResult.moduleVersion.goMod.sha256,
  goModH1: redirectResult.moduleVersion.goMod.h1,
  archiveSizeBytes: redirectResult.transfer.archiveSizeBytes,
  delivery: redirectResult.transfer.delivery,
  archiveExecuted: redirectResult.transfer.archiveExecuted,
  cacheRemoved: redirectResult.transfer.cacheRemoved,
}
const snapshot = { schemaVersion: 'dsh.go-public-module-version-snapshot/v1', fixture: { expected, officialStorageRedirect: { expected: redirectExpected, observed: redirectObservation } }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-metadata', status: metadataMatched ? 'passed' : 'failed' },
  { id: 'fixture-authentication', status: authenticationMatched ? 'passed' : 'failed' },
  { id: 'isolation-and-cleanup', status: isolationMatched ? 'passed' : 'failed' },
  { id: 'official-storage-redirect', status: redirectMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `go-public-module-version-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/go/read-authenticated-public-module-version.md',
  connectorId: 'go-public-module-version',
  probeDefinitionRef: 'repo:/probes/definitions/go-public-module-version-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/go/public-module-version/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'local-write', status: 'cleaned' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({
  outcome: report.outcome,
  modulePath: result.moduleVersion.modulePath,
  version: result.moduleVersion.version,
  moduleTreeH1: result.moduleVersion.moduleTreeH1,
  goModH1: result.moduleVersion.goMod.h1,
  archiveSizeBytes: result.transfer.archiveSizeBytes,
  verifier: result.authentication.verifier,
  cacheRemoved: result.transfer.cacheRemoved,
  officialStorageRedirect: { modulePath: redirectResult.moduleVersion.modulePath, version: redirectResult.moduleVersion.version, archiveSizeBytes: redirectResult.transfer.archiveSizeBytes, delivery: redirectResult.transfer.delivery },
  snapshotSha256: snapshotDigest,
  outputRoot,
}))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicPackageVersionEvidence } from '../connectors/nuget-org-public-package-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/nuget-org-public-package-version')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { packageId: 'Newtonsoft.Json', version: '13.0.3' }
const expected = {
  id: 'Newtonsoft.Json',
  version: '13.0.3',
  listed: true,
  minClientVersion: '2.12',
  licenseExpression: 'MIT',
  artifact: {
    fileName: 'newtonsoft.json.13.0.3.nupkg',
    sizeBytes: 2441966,
    sha256: '872fc189e638ab1056555b03aaa38f68bcb54286e221aa646eb1129babf63c77',
    sha512: '99b252bc77d1c5f5f7b51fd4ea7d5653e9961d7b3061cf9207f8643a9c7cc9965eebc84d6467f2989bb4723b1a244915cc232a78f894e8b748ca882a7c89fb92',
    entryCount: 24,
    declaredUncompressedBytes: 10493791,
    centralDirectorySha256: 'a6f7246fd990def006def14be3c53412266e8493b39cad8cda7f28b6992202a9',
    manifestEntry: { name: 'Newtonsoft.Json.nuspec', sizeBytes: 2413 },
    signatureEntry: { name: '.signature.p7s', sizeBytes: 24497 },
  },
}

const startedAt = new Date()
const result = await readPublicPackageVersionEvidence(fixtureInput)
const finishedAt = new Date()
const packageVersion = result.packageVersion
const artifact = packageVersion.artifact
const identityMatched = packageVersion.id === expected.id
  && packageVersion.version === expected.version
  && packageVersion.listed === expected.listed
  && packageVersion.minClientVersion === expected.minClientVersion
  && packageVersion.license.expression === expected.licenseExpression
const artifactMatched = Object.entries(expected.artifact).every(([key, value]) => JSON.stringify(artifact[key]) === JSON.stringify(value))
const redirectBoundary = result.access.redirectCount >= 0
  && result.access.redirectCount <= result.access.logicalGetCount
  && result.access.transportOrigins.every((origin) => ['https://api.nuget.org', 'https://nuget.azure.cn'].includes(origin))
const signatureBoundary = artifact.signaturePresent && !artifact.signatureCryptographicallyVerified
const minimized = !/(authors|owners|dependencyGroups|advisoryUrl|rawPayload|authorization|cookie|token|private person|@gmail)/i.test(JSON.stringify(result))
const executionBoundary = result.access.authentication === 'none'
  && result.access.packageDownloaded
  && !result.access.packageInstalled
  && !result.access.packageExecuted
  && !result.access.dependenciesResolved
const probePassed = result.conformance.status === 'passed' && identityMatched && artifactMatched && redirectBoundary && signatureBoundary && minimized && executionBoundary
const snapshot = { schemaVersion: 'dsh.nuget-org-public-package-version-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-package-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-artifact-bytes-and-zip-shape', status: artifactMatched ? 'passed' : 'failed' },
  { id: 'official-redirect-boundary', status: redirectBoundary ? 'passed' : 'failed' },
  { id: 'signature-verification-boundary', status: signatureBoundary ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
  { id: 'fixture-no-install-execution-or-dependency-resolution', status: executionBoundary ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `nuget-org-public-package-version-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/nuget-org/read-public-package-version-evidence.md',
  connectorId: 'nuget-org-public-package-version',
  probeDefinitionRef: 'repo:/probes/definitions/nuget-org-public-package-version-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/nuget-org/public-package-version/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, packageId: packageVersion.id, version: packageVersion.version, artifact: { sizeBytes: artifact.sizeBytes, sha256: artifact.sha256, sha512: artifact.sha512, entryCount: artifact.entryCount, signaturePresent: artifact.signaturePresent, signatureCryptographicallyVerified: artifact.signatureCryptographicallyVerified }, access: result.access, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicCrateVersion } from '../connectors/crates-io-public-crate-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/crates-io-public-crate-version')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { crateName: 'serde', version: '1.0.228' }
const expected = {
  description: 'A generic serialization/deserialization framework',
  licenseExpression: 'MIT OR Apache-2.0',
  rustVersion: '1.56',
  edition: '2021',
  yanked: false,
  createdAt: '2025-09-27T16:51:35.265Z',
  hasLibrary: true,
  binaryNames: [],
  repository: 'https://github.com/serde-rs/serde',
  homepage: 'https://serde.rs/',
  documentation: 'https://docs.rs/serde',
  artifactSizeBytes: 83652,
  artifactSha256: '9a8e94ea7f378bd32cbbd37198a4a91436180c5bb472411e48b5ec2e2124ae9e',
  downloadUrl: 'https://crates.io/api/v1/crates/serde/1.0.228/download',
}

const startedAt = new Date()
const result = await readPublicCrateVersion(fixtureInput)
const finishedAt = new Date()
const version = result.crateVersion
const identityMatched = version.crateName === fixtureInput.crateName && version.version === fixtureInput.version
const metadataMatched = version.description === expected.description
  && version.licenseExpression === expected.licenseExpression
  && version.rustVersion === expected.rustVersion
  && version.edition === expected.edition
  && version.yanked === expected.yanked
  && version.createdAt === expected.createdAt
  && version.hasLibrary === expected.hasLibrary
  && JSON.stringify(version.binaryNames) === JSON.stringify(expected.binaryNames)
  && version.links.repository === expected.repository
  && version.links.homepage === expected.homepage
  && version.links.documentation === expected.documentation
const artifactMatched = version.artifact.sizeBytes === expected.artifactSizeBytes
  && version.artifact.sha256 === expected.artifactSha256
  && version.artifact.downloadUrl === expected.downloadUrl
const serialized = JSON.stringify(result)
const minimized = !/(?:published_by|audit_actions|excluded-user|avatar|"downloads"|"features"|"dependencies"|cookie|token)/i.test(serialized)
const probePassed = result.conformance.status === 'passed' && identityMatched && metadataMatched && artifactMatched && minimized
const snapshot = { schemaVersion: 'dsh.crates-io-public-crate-version-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-metadata', status: metadataMatched ? 'passed' : 'failed' },
  { id: 'fixture-artifact', status: artifactMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `crates-io-public-crate-version-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/crates-io/read-public-crate-version.md',
  connectorId: 'crates-io-public-crate-version',
  probeDefinitionRef: 'repo:/probes/definitions/crates-io-public-crate-version-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/crates-io/public-crate-version/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({
  outcome: report.outcome,
  crateName: version.crateName,
  version: version.version,
  checksum: version.artifact.sha256,
  artifactSizeBytes: version.artifact.sizeBytes,
  snapshotSha256: snapshotDigest,
  outputRoot,
}))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicPackageVersion } from '../connectors/npm-public-package-version/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/npm-public-package-version')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { packageName: 'ajv', version: '8.20.0' }
const expected = {
  license: 'MIT',
  repositoryUrl: 'git+https://github.com/ajv-validator/ajv.git',
  integrity: 'sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==',
  shasum: '304b3636add88ba7d936760dd50ece006dea95f9',
  tarballUrl: 'https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz',
}

const startedAt = new Date()
const result = await readPublicPackageVersion(fixtureInput)
const finishedAt = new Date()
const identityMatched = result.packageVersion.name === fixtureInput.packageName && result.packageVersion.version === fixtureInput.version
const metadataMatched = result.packageVersion.license === expected.license && result.packageVersion.repository?.url === expected.repositoryUrl
const distributionMatched = result.packageVersion.distribution.integrity === expected.integrity
  && result.packageVersion.distribution.shasum === expected.shasum
  && result.packageVersion.distribution.tarballUrl === expected.tarballUrl
const minimized = !/(?:maintainer|contributor|author|email|cookie|token)/i.test(JSON.stringify(result))
const probePassed = result.conformance.status === 'passed' && identityMatched && metadataMatched && distributionMatched && minimized
const snapshot = { schemaVersion: 'dsh.npm-public-package-version-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-metadata', status: metadataMatched ? 'passed' : 'failed' },
  { id: 'fixture-distribution', status: distributionMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `npm-public-package-version-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/npm/read-public-package-version.md',
  connectorId: 'npm-public-package-version',
  probeDefinitionRef: 'repo:/probes/definitions/npm-public-package-version-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/npm/public-package-version/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, packageName: result.packageVersion.name, version: result.packageVersion.version, license: result.packageVersion.license, integrity: result.packageVersion.distribution.integrity, shasum: result.packageVersion.distribution.shasum, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

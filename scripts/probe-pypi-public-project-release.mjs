import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicProjectRelease } from '../connectors/pypi-public-project-release/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/pypi-public-project-release')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = { projectName: 'sampleproject', version: '4.0.0' }
const expected = {
  requiresPython: '>=3.9',
  licenseClassifier: 'License :: OSI Approved :: MIT License',
  distributions: {
    'sampleproject-4.0.0-py3-none-any.whl': {
      sha256: 'c23e447ea90d796d1e645c35c4b2de125040add12a845825546f91c93f391b6b',
      blake2b256: 'd773c16e5f3f0d37c60947e70865c255a58dc408780a6474de0523afd0ec553a',
      coreMetadataSha256: '067ccfe9a9c2bab291a27fa8662536adbd63ab12e3da003ae5dffdb0d20b2061',
    },
    'sampleproject-4.0.0.tar.gz': {
      sha256: '0ace7980f82c5815ede4cd7bf9f6693684cec2ae47b9b7ade9add533b8627c6b',
      blake2b256: '488cc18d25735962870ccb6d1cd2ac7bde40008a332211055e260cb7ec4c6bab',
      coreMetadataSha256: null,
    },
  },
}

const startedAt = new Date()
const result = await readPublicProjectRelease(fixtureInput)
const finishedAt = new Date()
const identityMatched = result.release.canonicalProjectName === fixtureInput.projectName && result.release.version === fixtureInput.version
const metadataMatched = result.release.requiresPython === expected.requiresPython
  && result.release.licenseClassifiers.includes(expected.licenseClassifier)
  && result.release.yanked === false
  && result.release.knownVulnerabilityCount === 0
const distributionsMatched = result.distributions.length === Object.keys(expected.distributions).length
  && result.distributions.every((file) => {
    const expectedFile = expected.distributions[file.filename]
    return expectedFile
      && file.sha256 === expectedFile.sha256
      && file.blake2b256 === expectedFile.blake2b256
      && file.coreMetadataSha256 === expectedFile.coreMetadataSha256
  })
const minimized = !/(?:author|maintainer|email|cookie|token)/i.test(JSON.stringify(result))
const probePassed = result.conformance.status === 'passed' && identityMatched && metadataMatched && distributionsMatched && minimized
const snapshot = { schemaVersion: 'dsh.pypi-public-project-release-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-metadata', status: metadataMatched ? 'passed' : 'failed' },
  { id: 'fixture-distributions', status: distributionsMatched ? 'passed' : 'failed' },
  { id: 'data-minimization', status: minimized ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `pypi-public-project-release-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/pypi/read-public-project-release.md',
  connectorId: 'pypi-public-project-release',
  probeDefinitionRef: 'repo:/probes/definitions/pypi-public-project-release-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/pypi/public-project-release/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, projectName: result.release.canonicalProjectName, version: result.release.version, distributions: result.distributions.map((file) => ({ filename: file.filename, sha256: file.sha256 })), lastSerial: result.registryState.lastSerial, etag: result.registryState.etag, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPublicImageManifestByDigest } from '../connectors/docker-hub-public-image-manifest/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, '.staging/docker-hub-public-image-manifest')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const fixtureInput = {
  repository: 'library/alpine',
  manifestDigest: 'sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d',
}
const expected = {
  kind: 'image-index',
  mediaType: 'application/vnd.oci.image.index.v1+json',
  bodySizeBytes: 9218,
  descriptorCount: 16,
  declaredReferencedBytes: 14614,
  descriptorSetDigest: '94dc462725a0801be3eb9e3289ac92d1df46a228c469b607033b540856aec09b',
  roles: { image: 8, attestation: 8 },
  amd64Digest: 'sha256:f27cad9117495d32d067133afff942cb2dc745dfe9163e949f6bfe8a6a245339',
  amd64AttestationDigest: 'sha256:1459b643bb61017ec8b54558c273b7fa1c1f6b68572464fdd480356caf1419aa',
}

const startedAt = new Date()
const result = await readPublicImageManifestByDigest(fixtureInput)
const finishedAt = new Date()
const manifest = result.manifest
const roleCounts = manifest.descriptors.reduce((counts, descriptor) => {
  counts[descriptor.role] = (counts[descriptor.role] ?? 0) + 1
  return counts
}, {})
const identityMatched = manifest.repository === fixtureInput.repository && manifest.digest === fixtureInput.manifestDigest
const indexMatched = manifest.kind === expected.kind
  && manifest.mediaType === expected.mediaType
  && manifest.bodySizeBytes === expected.bodySizeBytes
  && manifest.descriptorCount === expected.descriptorCount
  && manifest.declaredReferencedBytes === expected.declaredReferencedBytes
  && manifest.descriptorSetDigest === expected.descriptorSetDigest
  && roleCounts.image === expected.roles.image
  && roleCounts.attestation === expected.roles.attestation
  && manifest.descriptors.some((descriptor) => descriptor.role === 'image' && descriptor.digest === expected.amd64Digest && descriptor.platform?.architecture === 'amd64' && descriptor.platform?.os === 'linux')
  && manifest.descriptors.some((descriptor) => descriptor.role === 'attestation' && descriptor.digest === expected.amd64AttestationDigest && descriptor.referencedDigest === expected.amd64Digest)
const minimized = !/(docker-ratelimit-source|authorization|refresh_token|opaque-|eyJ|authors|annotations|rawPayload|request[_-]?id)/i.test(JSON.stringify(result))
const noLayerDownload = result.access.authentication === 'anonymous-bearer-token' && result.access.manifestGetCount === 1 && result.access.blobsDownloaded === false
const probePassed = result.conformance.status === 'passed' && identityMatched && indexMatched && minimized && noLayerDownload
const snapshot = { schemaVersion: 'dsh.docker-hub-public-image-manifest-snapshot/v1', fixture: { expected }, ...result }
const snapshotText = stableJson(snapshot)
const snapshotDigest = createHash('sha256').update(snapshotText).digest('hex')
const checks = [
  ...result.conformance.assertions.map((assertion) => ({ id: assertion.id, status: assertion.passed ? 'passed' : 'failed' })),
  { id: 'fixture-identity', status: identityMatched ? 'passed' : 'failed' },
  { id: 'fixture-index-surface', status: indexMatched ? 'passed' : 'failed' },
  { id: 'anonymous-token-minimized', status: minimized ? 'passed' : 'failed' },
  { id: 'no-config-or-layer-download', status: noLayerDownload ? 'passed' : 'failed' },
]
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `docker-hub-public-image-manifest-live-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/docker-hub/read-public-image-manifest-by-digest.md',
  connectorId: 'docker-hub-public-image-manifest',
  probeDefinitionRef: 'repo:/probes/definitions/docker-hub-public-image-manifest-live.json',
  environment: 'production-public',
  level: 'live',
  outcome: probePassed ? 'passed' : 'partial',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: new Date(finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  checks,
  evidence: [{ kind: 'snapshot', ref: 'repo:/knowledge/verifications/docker-hub/public-image-manifest/snapshot.json', sha256: snapshotDigest }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(path.join(outputRoot, 'snapshot.json'), snapshotText),
  writeFile(path.join(outputRoot, 'report.json'), stableJson(report)),
])
process.stdout.write(stableJson({ outcome: report.outcome, repository: manifest.repository, digest: manifest.digest, kind: manifest.kind, descriptorCount: manifest.descriptorCount, declaredReferencedBytes: manifest.declaredReferencedBytes, descriptorSetDigest: manifest.descriptorSetDigest, rateLimit: result.rateLimit, snapshotSha256: snapshotDigest, outputRoot }))
if (!probePassed) process.exitCode = 1

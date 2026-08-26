import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCratesIoPublicCrateVersionMaintenance } from '../src/index.mjs'
import { CratesIoPublicCrateVersionError } from '../../../connectors/crates-io-public-crate-version/src/index.mjs'

const stableResult = {
  crateVersion: {
    crateName: 'serde',
    version: '1.0.228',
    licenseExpression: 'MIT OR Apache-2.0',
    rustVersion: '1.56',
    edition: '2021',
    yanked: false,
    yankedMessage: null,
    createdAt: '2025-09-27T16:51:35.265Z',
    updatedAt: '2025-09-27T16:51:35.265Z',
    hasLibrary: true,
    binaryNames: [],
    links: { repository: 'https://github.com/serde-rs/serde', homepage: 'https://serde.rs/', documentation: 'https://docs.rs/serde' },
    artifact: {
      sizeBytes: 83652,
      sha256: '9a8e94ea7f378bd32cbbd37198a4a91436180c5bb472411e48b5ec2e2124ae9e',
      downloadUrl: 'https://crates.io/api/v1/crates/serde/1.0.228/download',
    },
  },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when stable metadata and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectCratesIoPublicCrateVersionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when integrity or yank metadata changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = {
    ...stableResult,
    crateVersion: {
      ...stableResult.crateVersion,
      yanked: true,
      yankedMessage: 'fixture',
      artifact: { ...stableResult.crateVersion.artifact, sha256: 'b'.repeat(64) },
    },
  }
  const result = await collectCratesIoPublicCrateVersionMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'review-crates-io-version-metadata-change')
})

test('defers rate limits and access-policy blocks without claiming connector drift', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  for (const code of ['rate-limited', 'access-policy-blocked']) {
    let calls = 0
    const reader = async () => {
      calls += 1
      throw new CratesIoPublicCrateVersionError(code, { code, httpStatus: code === 'rate-limited' ? 429 : 403, retryAt: '2026-08-27T00:02:00.000Z' })
    }
    const result = await collectCratesIoPublicCrateVersionMaintenance({ reader, acceptedState })
    assert.equal(result.status, 'deferred')
    assert.equal(result.proposals[0].reason, code)
    assert.equal(calls, 1)
  }
})

test('turns other failures into one connector proposal without retrying', async () => {
  let calls = 0
  const reader = async () => { calls += 1; throw new Error('HTTP_503') }
  const result = await collectCratesIoPublicCrateVersionMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-crates-io-api-access')
  assert.equal(calls, 1)
})

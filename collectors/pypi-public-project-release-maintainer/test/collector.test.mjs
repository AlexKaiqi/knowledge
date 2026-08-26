import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPyPIPublicProjectReleaseMaintenance } from '../src/index.mjs'
import { PyPIPublicProjectReleaseError } from '../../../connectors/pypi-public-project-release/src/index.mjs'

const stableResult = {
  resultDigest: 'a'.repeat(64),
  release: {
    canonicalProjectName: 'sampleproject',
    version: '4.0.0',
    requiresPython: '>=3.9',
    licenseExpression: null,
    licenseClassifiers: ['License :: OSI Approved :: MIT License'],
    yanked: false,
    yankedReason: null,
    knownVulnerabilityCount: 0,
  },
  distributions: [{
    filename: 'sampleproject-4.0.0.tar.gz',
    sizeBytes: 5760,
    yanked: false,
    yankedReason: null,
    sha256: '0ace7980f82c5815ede4cd7bf9f6693684cec2ae47b9b7ade9add533b8627c6b',
    blake2b256: '488cc18d25735962870ccb6d1cd2ac7bde40008a332211055e260cb7ec4c6bab',
    coreMetadataSha256: null,
  }],
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when selected release metadata and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectPyPIPublicProjectReleaseMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when release file integrity changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, resultDigest: 'b'.repeat(64), distributions: [{ ...stableResult.distributions[0], sha256: 'b'.repeat(64) }] }
  const result = await collectPyPIPublicProjectReleaseMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-pypi-release-metadata-change'), true)
})

test('defers an API rate limit without claiming Connector drift', async () => {
  let calls = 0
  const reader = async () => {
    calls += 1
    throw new PyPIPublicProjectReleaseError('HTTP_429', { code: 'rate-limited', httpStatus: 429, retryAfter: '120', retryAt: '2026-08-27T00:02:00.000Z' })
  }
  const result = await collectPyPIPublicProjectReleaseMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'deferred')
  assert.equal(result.proposals[0].notBefore, '2026-08-27T00:02:00.000Z')
  assert.equal(calls, 1)
})

test('turns non-rate-limit failures into one Connector proposal without retrying', async () => {
  let calls = 0
  const reader = async () => { calls += 1; throw new Error('HTTP_503') }
  const result = await collectPyPIPublicProjectReleaseMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-pypi-json-api-access')
  assert.equal(calls, 1)
})

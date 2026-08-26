import assert from 'node:assert/strict'
import test from 'node:test'
import { collectNpmPublicPackageVersionMaintenance } from '../src/index.mjs'
import { NpmPublicPackageVersionError } from '../../../connectors/npm-public-package-version/src/index.mjs'

const stableResult = {
  packageVersion: {
    name: 'ajv',
    version: '8.20.0',
    license: 'MIT',
    deprecated: null,
    repository: { type: 'git', url: 'git+https://github.com/ajv-validator/ajv.git', directory: null },
    distribution: {
      integrity: 'sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==',
      shasum: '304b3636add88ba7d936760dd50ece006dea95f9',
      tarballUrl: 'https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz',
    },
  },
  conformance: { status: 'passed', assertions: [] },
}

test('stays current when selected package metadata and verification freshness match', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const result = await collectNpmPublicPackageVersionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when immutable distribution metadata changes', async () => {
  const acceptedState = { snapshot: stableResult, report: { expiresAt: '2026-09-03T00:00:00Z' } }
  const current = { ...stableResult, packageVersion: { ...stableResult.packageVersion, distribution: { ...stableResult.packageVersion.distribution, shasum: 'a'.repeat(40) } } }
  const result = await collectNpmPublicPackageVersionMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals.some((proposal) => proposal.action === 'review-npm-package-version-metadata-change'), true)
})

test('turns registry failures into one connector proposal without retrying', async () => {
  let calls = 0
  const reader = async () => { calls += 1; throw new Error('HTTP_503') }
  const result = await collectNpmPublicPackageVersionMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'restore-npm-public-registry-access')
  assert.equal(calls, 1)
})

test('defers Registry rate limiting without claiming Connector drift', async () => {
  let calls = 0
  const reader = async () => {
    calls += 1
    throw new NpmPublicPackageVersionError('HTTP_429', { code: 'rate-limited', httpStatus: 429, retryAfter: '120', retryAt: '2026-08-27T00:02:00.000Z' })
  }
  const result = await collectNpmPublicPackageVersionMaintenance({ reader, acceptedState: { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } } })
  assert.equal(result.status, 'deferred')
  assert.equal(result.proposals[0].action, 'rerun-after-rate-limit-reset')
  assert.equal(result.proposals[0].notBefore, '2026-08-27T00:02:00.000Z')
  assert.equal(calls, 1)
})

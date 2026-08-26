import assert from 'node:assert/strict'
import test from 'node:test'
import { collectGoPublicModuleVersionMaintenance } from '../src/index.mjs'
import { GoPublicModuleVersionError } from '../../../connectors/go-public-module-version/src/index.mjs'

const stableResult = {
  moduleVersion: {
    modulePath: 'rsc.io/quote', version: 'v1.5.2', publishedAt: '2018-02-14T15:44:20.000Z', moduleTreeH1: 'h1:tree=',
    goMod: { moduleDirective: 'rsc.io/quote', content: 'module rsc.io/quote\n', sizeBytes: 20, sha256: 'abc', h1: 'h1:mod=' },
  },
  authentication: { status: 'authenticated', method: 'go-command-sumdb', verifier: 'go1.24.2', checksumDatabase: 'sum.golang.org' },
  transfer: { archiveSizeBytes: 2987, delivery: 'direct', archiveExecuted: false, cacheRemoved: true },
  conformance: { status: 'passed', assertions: [{ id: 'authenticated', passed: true }] },
}
const acceptedState = { snapshot: stableResult, report: { expiresAt: '2099-01-01T00:00:00Z' } }

test('reports current when authenticated fixture evidence and verification are unchanged', async () => {
  const result = await collectGoPublicModuleVersionMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), reader: async () => stableResult, acceptedState })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('proposes review when module evidence or verifier changes', async () => {
  const current = structuredClone(stableResult)
  current.moduleVersion.goMod.h1 = 'h1:changed='
  current.authentication.verifier = 'go1.25.0'
  const result = await collectGoPublicModuleVersionMaintenance({ reader: async () => current, acceptedState })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'review-go-module-version-evidence-change')
})

test('defers without retrying when a public Go service is rate limited', async () => {
  let calls = 0
  const reader = async () => {
    calls += 1
    throw new GoPublicModuleVersionError('HTTP_429', { code: 'rate-limited', httpStatus: 429, retryAt: '2026-08-27T00:02:00.000Z' })
  }
  const result = await collectGoPublicModuleVersionMaintenance({ reader, acceptedState })
  assert.equal(result.status, 'deferred')
  assert.equal(result.proposals[0].notBefore, '2026-08-27T00:02:00.000Z')
  assert.equal(calls, 1)
})

test('escalates checksum authentication failures distinctly', async () => {
  const reader = async () => { throw new GoPublicModuleVersionError('checksum mismatch', { code: 'authentication-failed' }) }
  const result = await collectGoPublicModuleVersionMaintenance({ reader, acceptedState })
  assert.equal(result.status, 'unreachable')
  assert.equal(result.proposals[0].action, 'investigate-go-checksum-authentication-failure')
})

test('requests a fresh report after expiry', async () => {
  const result = await collectGoPublicModuleVersionMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    reader: async () => stableResult,
    acceptedState: { snapshot: stableResult, report: { expiresAt: '2026-08-26T00:00:00Z' } },
  })
  assert.equal(result.status, 'review-required')
  assert.equal(result.proposals[0].action, 'rerun-live-probe')
})

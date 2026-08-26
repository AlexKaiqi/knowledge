import assert from 'node:assert/strict'
import test from 'node:test'
import { collectOsvPublicAdvisoryMaintenance } from '../src/index.mjs'
import { OsvPublicAdvisoryError } from '../../../connectors/osv-public-advisory/src/index.mjs'
const stable = { resultDigest: 'a'.repeat(64), advisory: { modifiedAt: '2022-04-13T03:04:37.331Z' }, conformance: { status: 'passed' } }
test('stays current and proposes semantic changes', async () => {
  const acceptedState = { snapshot: stable, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  assert.equal((await collectOsvPublicAdvisoryMaintenance({ reader: async () => stable, acceptedState })).status, 'current')
  const changed = await collectOsvPublicAdvisoryMaintenance({ reader: async () => ({ ...stable, resultDigest: 'b'.repeat(64), advisory: { modifiedAt: '2026-01-01T00:00:00Z' } }), acceptedState })
  assert.equal(changed.proposals[0].action, 'review-osv-advisory-change')
})
test('distinguishes rate limits, removal, and access failure', async () => {
  const acceptedState = { snapshot: stable, report: { expiresAt: '2099-01-01T00:00:00Z' } }
  const run = (error) => collectOsvPublicAdvisoryMaintenance({ reader: async () => { throw error }, acceptedState })
  assert.equal((await run(new OsvPublicAdvisoryError('x', { code: 'rate-limited' }))).status, 'deferred')
  assert.equal((await run(new OsvPublicAdvisoryError('x', { code: 'advisory-not-found' }))).proposals[0].action, 'review-osv-advisory-removed')
  assert.equal((await run(new Error('503'))).status, 'unreachable')
})

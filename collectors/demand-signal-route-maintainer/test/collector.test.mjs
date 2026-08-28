import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDemandSignalRouteMaintenance, demandRouteSources } from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })

test('all researched demand routes remain proposal-free while their reviewed semantics are present', async () => {
  const result = await collectDemandSignalRouteMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: currentSource })
  assert.equal(demandRouteSources.length, 26)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('pricing drift and platform policy drift remain distinct proposals', async () => {
  const result = await collectDemandSignalRouteMaintenance({
    now: () => new Date('2026-08-27T00:00:00Z'),
    sourceCheck: async (source) => ['serpapi-pricing', 'boss-user-protocol'].includes(source.id) ? { id: source.id, status: 'review-required', observedDigest: source.id === 'serpapi-pricing' ? 'b'.repeat(64) : 'c'.repeat(64) } : currentSource(source),
  })
  assert.deepEqual(result.proposals, [
    { kind: 'knowledge-proposal', action: 'review-provider-price-or-plan-change', sourceId: 'serpapi-pricing', observedDigest: 'b'.repeat(64) },
    { kind: 'knowledge-proposal', action: 'review-demand-route-semantics-change', sourceId: 'boss-user-protocol', observedDigest: 'c'.repeat(64) },
  ])
})

test('source failure stays a proposal and never activates a suspended scraper', async () => {
  const result = await collectDemandSignalRouteMaintenance({ now: () => new Date('2026-08-27T00:00:00Z'), sourceCheck: async (source) => source.id === 'bright-data-boss' ? { id: source.id, status: 'unreachable', httpStatus: 403 } : currentSource(source) })
  assert.deepEqual(result.proposals, [{ kind: 'knowledge-proposal', action: 'recheck-demand-route-source', sourceId: 'bright-data-boss', reason: 'HTTP_403' }])
})

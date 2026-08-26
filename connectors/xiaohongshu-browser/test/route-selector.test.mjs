import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { canFailOver, selectAccessRoute } from '../src/route-selector.mjs'

const capabilityRef = '/capabilities/xiaohongshu/publish-private-note-and-observe.md'
const ownedNotesCapabilityRef = '/capabilities/xiaohongshu/list-owned-notes.md'

function verifiedRoute(id, priority, failureDomains = ['domain-a']) {
  return {
    id,
    lifecycle: 'verified',
    contractLevel: 'full',
    automaticSelectionEligible: true,
    priority,
    failureDomains,
    capabilityCoverage: [{ capabilityRef, phases: ['submit', 'reconcile', 'observe'], gaps: [] }],
  }
}

test('the real catalog exposes no route for automatic use before live conformance', async () => {
  const catalog = JSON.parse(await readFile(new URL('../routes.json', import.meta.url), 'utf8'))
  assert.equal(selectAccessRoute(catalog, {
    capabilityRef,
    requiredPhases: ['submit', 'reconcile', 'observe'],
    healthByRoute: Object.fromEntries(catalog.routes.map((route) => [route.id, 'healthy'])),
  }), null)
})

test('the real catalog selects only the verified owned-note read route', async () => {
  const catalog = JSON.parse(await readFile(new URL('../routes.json', import.meta.url), 'utf8'))
  const healthByRoute = Object.fromEntries(catalog.routes.map((route) => [route.id, 'healthy']))
  assert.equal(selectAccessRoute(catalog, {
    capabilityRef: ownedNotesCapabilityRef,
    requiredPhases: ['authorize', 'observe'],
    healthByRoute,
  }).id, 'owned-notes-xiaohongshu-mcp')
  assert.equal(selectAccessRoute(catalog, {
    capabilityRef,
    requiredPhases: ['submit', 'reconcile', 'observe'],
    healthByRoute,
  }), null)
})

test('selector uses only healthy verified full-contract routes with complete coverage', () => {
  const catalog = {
    selectionPolicy: { automaticRouteRequirements: { lifecycles: ['verified'], contractLevels: ['full'], requireHealthy: true } },
    routes: [
      { ...verifiedRoute('candidate-route', 1), lifecycle: 'candidate', automaticSelectionEligible: false },
      { ...verifiedRoute('unhealthy-route', 2) },
      verifiedRoute('healthy-route', 3),
    ],
  }
  assert.equal(selectAccessRoute(catalog, {
    capabilityRef,
    requiredPhases: ['submit', 'reconcile', 'observe'],
    healthByRoute: { 'unhealthy-route': 'unhealthy', 'healthy-route': 'healthy' },
  }).id, 'healthy-route')
})

test('platform writes only fail over before an effect that definitely did not execute', () => {
  assert.equal(canFailOver({ effect: 'platform-write', effectStarted: false, outcomeCertainty: 'definitely-not-executed' }), true)
  assert.equal(canFailOver({ effect: 'platform-write', effectStarted: true, outcomeCertainty: 'possibly-executed' }), false)
  assert.equal(canFailOver({ effect: 'platform-write', effectStarted: true, outcomeCertainty: 'unknown' }), false)
  assert.equal(canFailOver({ effect: 'read', effectStarted: false, outcomeCertainty: 'unknown' }), true)
})

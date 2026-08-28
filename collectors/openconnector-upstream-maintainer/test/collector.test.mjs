import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectOpenConnectorUpstreamMaintenance,
  projectCatalog,
  upstreamSources,
} from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, role: source.role, status: 'current', observedDigest: 'a'.repeat(64), digestCurrent: null, assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentHead = async (repository) => projectCatalog.projects.find((project) => project.repository === repository).observedRevision
const currentTags = async () => projectCatalog.releaseTagBaselines['oomol-lab-open-connector']

test('current upstream evidence produces only the still-unapproved paid probe proposal', async () => {
  const result = await collectOpenConnectorUpstreamMaintenance({
    now: () => new Date('2026-08-27T10:00:00Z'),
    sourceCheck: currentSource,
    headReader: currentHead,
    tagReader: currentTags,
    report: null,
  })
  assert.equal(upstreamSources.length, 7)
  assert.equal(result.projects.length, 2)
  assert.equal(result.releases.length, 1)
  assert.equal(result.status, 'review-required')
  assert.deepEqual(result.proposals, [{
    kind: 'verification-report',
    action: 'prepare-approved-openconnector-public-social-search-probe',
    probeDefinitionRef: 'repo:/probes/definitions/openconnector-public-social-search-live.json',
    requires: ['provider-and-platform-terms-review', 'content-use-determination', 'encrypted-loopback-runtime', 'scoped-tikhub-connection', 'scoped-runtime-token', 'opaque-probe-identity', 'fixed-query-approval', 'maximum-usd-one-spend-approval'],
  }])
})

test('security, pricing, head and release drift remain separate proposals', async () => {
  const result = await collectOpenConnectorUpstreamMaintenance({
    now: () => new Date('2026-08-27T10:00:00Z'),
    sourceCheck: async (source) => ['oomol-openconnector-credentials', 'oomol-pricing'].includes(source.id)
      ? { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'changed', passed: false }] }
      : currentSource(source),
    headReader: async (repository) => repository.includes('oomol-lab') ? 'b'.repeat(40) : currentHead(repository),
    tagReader: async () => ({ tagCount: 14, digest: 'c'.repeat(64) }),
    report: { id: 'accepted', outcome: 'passed', expiresAt: '2026-09-27T00:00:00Z' },
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-openconnector-security-contract',
    'review-oomol-managed-route-pricing',
    'audit-openconnector-project-head-change',
    'audit-openconnector-release-tag-change',
  ])
})

test('a source failure never installs, activates or switches the candidate route', async () => {
  const result = await collectOpenConnectorUpstreamMaintenance({
    sourceCheck: async (source) => source.id === 'oomol-public-social-research-skill' ? { id: source.id, role: source.role, status: 'unreachable', httpStatus: 403 } : currentSource(source),
    headReader: currentHead,
    tagReader: currentTags,
    report: { id: 'accepted', outcome: 'passed', expiresAt: '2099-01-01T00:00:00Z' },
  })
  assert.deepEqual(result.proposals, [{ kind: 'connector-change-proposal', action: 'restore-openconnector-source-observation', sourceId: 'oomol-public-social-research-skill', reason: 'HTTP_403' }])
  assert.equal(JSON.stringify(result).includes('install'), false)
  assert.equal(JSON.stringify(result).includes('activate'), false)
  assert.equal(JSON.stringify(result).includes('switch'), false)
})

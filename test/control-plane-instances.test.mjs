import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

async function validator(schemaPath) {
  const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile(schema)
}

test('control-plane instances match their schemas', async () => {
  const cases = [
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-browser/connector.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/xiaohongshu-browser/routes.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-maintainer/collector.json'],
    ['../spec/source-watch-list.schema.json', '../collectors/xiaohongshu-maintainer/sources.json'],
    ['../spec/ecosystem-project-catalog.schema.json', '../collectors/xiaohongshu-maintainer/projects.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-private-note-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-account-docs/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-account-docs-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-account-api-live.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-owned-notes-live.json'],
    ['../spec/probe-identity.schema.json', '../probes/identities/xiaohongshu-owned-default.json'],
    ['../spec/probe-identity-pool.schema.json', '../probes/pools/xiaohongshu-owned-probes.json'],
    ['../spec/connector-definition.schema.json', '../connectors/xiaohongshu-community-rules-browser/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/xiaohongshu-community-rules-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/xiaohongshu-community-rules-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/douyin-open-platform-docs/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-open-platform-docs-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/douyin-open-platform-docs-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/douyin-public-video-embed/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-public-video-embed-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/douyin-public-video-embed-live.json'],
    ['../spec/access-route-catalog.schema.json', '../connectors/douyin-access-routes/routes.json'],
    ['../spec/collector-definition.schema.json', '../collectors/douyin-maintainer/collector.json'],
    ['../spec/ecosystem-project-catalog.schema.json', '../collectors/douyin-maintainer/projects.json'],
    ['../spec/connector-definition.schema.json', '../connectors/hugging-face-public-model-revision/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/hugging-face-public-model-revision-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/hugging-face-public-model-revision-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-search/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-search-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-search-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-file/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-file-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-file-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-tags/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-tags-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-tags-live.json'],
    ['../spec/connector-definition.schema.json', '../connectors/github-public-repository-release/connector.json'],
    ['../spec/collector-definition.schema.json', '../collectors/github-public-repository-release-maintainer/collector.json'],
    ['../spec/probe-definition.schema.json', '../probes/definitions/github-public-repository-release-live.json'],
  ]
  for (const [schemaPath, instancePath] of cases) {
    const validate = await validator(schemaPath)
    const instance = JSON.parse(await readFile(new URL(instancePath, import.meta.url), 'utf8'))
    assert.equal(validate(instance), true, `${instancePath}: ${JSON.stringify(validate.errors)}`)
  }
})

test('Connector handlers can carry capability-specific conformance', async () => {
  const connector = JSON.parse(await readFile(new URL('../connectors/xiaohongshu-browser/connector.json', import.meta.url), 'utf8'))
  const publish = connector.handlers.find((handler) => handler.operation === 'publishPrivateNoteAndObserve')
  const listing = connector.handlers.find((handler) => handler.operation === 'listOwnedNotes')
  assert.equal(publish.conformance, undefined)
  assert.equal(connector.conformance.status, 'candidate')
  assert.equal(listing.conformance.status, 'verified')
  assert.equal(listing.conformance.probeReportRef, '/verifications/xiaohongshu/owned-notes/report.json')
})

test('Connector configuration schemas compile', async () => {
  for (const schemaPath of [
    '../connectors/xiaohongshu-browser/config.schema.json',
    '../connectors/xiaohongshu-account-docs/config.schema.json',
    '../connectors/xiaohongshu-community-rules-browser/config.schema.json',
    '../connectors/douyin-open-platform-docs/config.schema.json',
    '../connectors/douyin-public-video-embed/config.schema.json',
    '../connectors/hugging-face-public-model-revision/config.schema.json',
    '../connectors/github-public-repository-search/config.schema.json',
    '../connectors/github-public-repository-file/config.schema.json',
    '../connectors/github-public-repository-tags/config.schema.json',
    '../connectors/github-public-repository-release/config.schema.json',
    '../connectors/github-public-repository-work-item-changes/config.schema.json',
  ]) {
    const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url), 'utf8'))
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    assert.doesNotThrow(() => ajv.compile(schema))
  }
})

test('GitHub live snapshot payload matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/search-public-repositories-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-search/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository file live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/read-public-repository-file-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-file/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository tags live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/list-public-repository-tags-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-tags/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository release live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/read-public-repository-release-by-tag-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-release/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('Douyin public video embed live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/douyin/read-public-video-embed-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/douyin/public-video-embed/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('Hugging Face public model revision live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/hugging-face/read-public-model-revision-manifest-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/hugging-face/public-model-revision/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test('GitHub public repository work-item change live snapshot matches its product output schema', async () => {
  const validate = await validator('../knowledge/schemas/github/list-public-repository-work-item-changes-output.schema.json')
  const snapshot = JSON.parse(await readFile(new URL('../knowledge/verifications/github/public-repository-work-item-changes/snapshot.json', import.meta.url), 'utf8'))
  const { schemaVersion: _schemaVersion, fixture: _fixture, ...payload } = snapshot
  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

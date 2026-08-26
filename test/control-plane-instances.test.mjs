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

test('Xiaohongshu candidate control-plane instances match their schemas', async () => {
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

test('Xiaohongshu connector configuration schema compiles', async () => {
  for (const schemaPath of [
    '../connectors/xiaohongshu-browser/config.schema.json',
    '../connectors/xiaohongshu-account-docs/config.schema.json',
    '../connectors/xiaohongshu-community-rules-browser/config.schema.json',
  ]) {
    const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url), 'utf8'))
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    assert.doesNotThrow(() => ajv.compile(schema))
  }
})

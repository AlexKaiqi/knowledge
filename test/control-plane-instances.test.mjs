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
  ]
  for (const [schemaPath, instancePath] of cases) {
    const validate = await validator(schemaPath)
    const instance = JSON.parse(await readFile(new URL(instancePath, import.meta.url), 'utf8'))
    assert.equal(validate(instance), true, `${instancePath}: ${JSON.stringify(validate.errors)}`)
  }
})

test('Xiaohongshu connector configuration schema compiles', async () => {
  const schema = JSON.parse(await readFile(new URL('../connectors/xiaohongshu-browser/config.schema.json', import.meta.url), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  assert.doesNotThrow(() => ajv.compile(schema))
})

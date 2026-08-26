import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

test('all knowledge control-plane schemas compile with unique ids', async () => {
  const directory = new URL('../spec/', import.meta.url)
  const files = (await readdir(directory)).filter((file) => file.endsWith('.schema.json')).sort()
  assert.equal(files.length, 10)
  const ids = new Set()
  for (const file of files) {
    const schema = JSON.parse(await readFile(new URL(file, directory), 'utf8'))
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', file)
    assert.equal(typeof schema.$id, 'string', file)
    assert.equal(ids.has(schema.$id), false, `duplicate schema id: ${schema.$id}`)
    ids.add(schema.$id)
    const ajv = new Ajv2020({ allErrors: true })
    addFormats(ajv)
    assert.doesNotThrow(() => ajv.compile(schema), file)
  }
})

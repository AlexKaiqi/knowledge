import assert from 'node:assert/strict'
import { access, readdir } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('repository initializes every responsibility boundary', async () => {
  const required = [
    'knowledge/index.md',
    'knowledge/log.md',
    'knowledge/platforms/index.md',
    'knowledge/tools/index.md',
    'knowledge/sources/index.md',
    'knowledge/concepts/index.md',
    'knowledge/capabilities/index.md',
    'knowledge/schemas/index.md',
    'knowledge/policies/index.md',
    'knowledge/verifications/index.md',
    'knowledge/references/index.md',
    'connectors/README.md',
    'collectors/README.md',
    'probes/README.md',
    'spec/README.md',
  ]
  await Promise.all(required.map((path) => access(new URL(path, root))))
})

test('canonical knowledge contains no unverified platform or capability', async () => {
  const cases = [
    ['knowledge/platforms/', '.md'],
    ['knowledge/capabilities/', '.md'],
  ]
  for (const [directory, suffix] of cases) {
    const entries = await readdir(new URL(directory, root), { withFileTypes: true })
    const instances = entries.filter((entry) => entry.name !== 'index.md' && entry.name !== 'README.md' && (suffix ? entry.name.endsWith(suffix) : entry.isDirectory()))
    assert.deepEqual(instances.map((entry) => entry.name), [], directory)
  }
})

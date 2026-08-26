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

async function markdownInstances(directory, prefix = '') {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true })
  const paths = []
  for (const entry of entries) {
    if (entry.name === 'index.md' || entry.name === 'README.md') continue
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory()) paths.push(...await markdownInstances(`${directory}${entry.name}/`, `${relative}/`))
    else if (entry.name.endsWith('.md')) paths.push(relative)
  }
  return paths.sort()
}

test('canonical knowledge contains only probe-admitted platform and capability files', async () => {
  assert.deepEqual(await markdownInstances('knowledge/platforms/'), ['xiaohongshu.md'])
  assert.deepEqual(await markdownInstances('knowledge/capabilities/'), [
    'xiaohongshu/list-owned-notes.md',
    'xiaohongshu/read-account-api-surface.md',
    'xiaohongshu/read-community-rule-surface.md',
  ])
})

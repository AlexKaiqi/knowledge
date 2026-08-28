import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  collectXiaohongshuAndroidObservationMaintenance,
  inspectLocalAndroidRuntime,
  mobileObservationProjects,
  mobileObservationSources,
} from '../src/index.mjs'

const currentSource = async (source) => ({ id: source.id, role: source.role, status: 'current', observedDigest: 'a'.repeat(64), assertions: source.observation.assertions.map((assertion) => ({ id: assertion.id, passed: true })) })
const currentHead = async (repository) => mobileObservationProjects.find((project) => project.repository === repository).commit
const currentRuntime = async () => ({ adbAvailable: true, connectedDeviceCount: 1, blockedDeviceCount: 0, ready: true })
const currentReport = { id: 'accepted', outcome: 'passed', expiresAt: '2026-09-27T00:00:00Z' }

test('collector definition, sources and probe match repository schemas', async () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  addFormats(ajv)
  const cases = [
    ['../../../spec/collector-definition.schema.json', '../collector.json'],
    ['../../../spec/source-watch-list.schema.json', '../sources.json'],
    ['../../../spec/probe-definition.schema.json', '../../../probes/definitions/xiaohongshu-android-public-search-live.json'],
  ]
  for (const [schemaPath, instancePath] of cases) {
    const schema = JSON.parse(await readFile(new URL(schemaPath, import.meta.url)))
    const instance = JSON.parse(await readFile(new URL(instancePath, import.meta.url)))
    const validate = ajv.compile(schema)
    assert.equal(validate(instance), true, `${instancePath}: ${JSON.stringify(validate.errors)}`)
  }
})

test('current sources, heads, device, identity and fresh proof require no proposal', async () => {
  const result = await collectXiaohongshuAndroidObservationMaintenance({
    now: () => new Date('2026-08-27T10:00:00Z'),
    sourceCheck: currentSource,
    headReader: currentHead,
    runtimeInspector: currentRuntime,
    identityAllowed: true,
    report: currentReport,
  })
  assert.equal(mobileObservationSources.length, 3)
  assert.equal(mobileObservationProjects.length, 2)
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

test('protocol, license, project and local-runtime drift remain separate proposals', async () => {
  const result = await collectXiaohongshuAndroidObservationMaintenance({
    sourceCheck: async (source) => source.id === 'mobilerun-portal-license'
      ? { id: source.id, role: source.role, status: 'review-required', assertions: [{ id: 'agpl-version', passed: false }] }
      : currentSource(source),
    headReader: async (repository) => repository.includes('mobilerun-portal') ? 'b'.repeat(40) : currentHead(repository),
    runtimeInspector: async () => ({ adbAvailable: true, connectedDeviceCount: 0, blockedDeviceCount: 0, ready: false }),
    identityAllowed: false,
    report: null,
  })
  assert.deepEqual(result.proposals.map((proposal) => proposal.action), [
    'review-mobilerun-portal-license-change',
    'audit-mobile-observation-project-head-change',
    'attach-or-create-dedicated-android-probe',
    'review-xiaohongshu-android-probe-identity-extension',
    'prepare-approved-xiaohongshu-android-search-probe',
  ])
})

test('ADB readiness is aggregate and never returns device serials', async () => {
  const result = await inspectLocalAndroidRuntime(async () => ({ stdout: 'List of devices attached\nserial-sensitive device product:test model:Pixel\nserial-other unauthorized usb:1\n', stderr: '' }))
  assert.deepEqual(result, { adbAvailable: true, connectedDeviceCount: 1, blockedDeviceCount: 1, ready: false })
  assert.equal(JSON.stringify(result).includes('serial-sensitive'), false)
  assert.equal(JSON.stringify(result).includes('Pixel'), false)
})

test('collector never installs, enables permissions, logs in, switches routes or runs a live probe', async () => {
  const result = await collectXiaohongshuAndroidObservationMaintenance({
    sourceCheck: currentSource,
    headReader: currentHead,
    runtimeInspector: async () => ({ adbAvailable: false, connectedDeviceCount: 0, blockedDeviceCount: 0, ready: false, reason: 'adb-unavailable' }),
    identityAllowed: false,
    report: null,
  })
  const serialized = JSON.stringify(result)
  for (const forbidden of ['install-apk', 'enable-accessibility', 'perform-login', 'switch-route', 'execute-live-probe']) assert.equal(serialized.includes(forbidden), false)
})

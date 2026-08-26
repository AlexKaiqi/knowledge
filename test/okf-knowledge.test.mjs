import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { validateKnowledgeBundle } from '../scripts/okf-catalog-lib.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const knowledgeRoot = path.join(repositoryRoot, 'knowledge')
const contractRoot = path.join(repositoryRoot, 'spec')
const verificationTime = new Date('2026-08-26T12:00:00Z')

test('canonical OKF bundle contains only probe-backed admitted knowledge', async () => {
  const result = await validateKnowledgeBundle({ root: knowledgeRoot, contractRoot, now: verificationTime })
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2))
  assert.deepEqual(result.summary, { documents: 42, capabilities: 11, admittedSubjects: 7 })
})

test('admission rejects unverified subject knowledge', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-okf-unverified-'))
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  await cp(knowledgeRoot, temporaryRoot, { recursive: true })
  await mkdir(path.join(temporaryRoot, 'platforms'), { recursive: true })
  await writeFile(path.join(temporaryRoot, 'platforms/example.md'), '---\ntype: Platform\ntitle: Example\n---\n\n# Example\n')
  const result = await validateKnowledgeBundle({ root: temporaryRoot, contractRoot, now: verificationTime })
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.code === 'knowledge.verification-missing'), true)
  assert.equal(result.errors.some((error) => error.code === 'knowledge.orphan-subject'), true)
})

test('admission rejects stale canonical knowledge', async () => {
  const result = await validateKnowledgeBundle({
    root: knowledgeRoot,
    contractRoot,
    now: new Date('2026-11-27T00:00:00Z'),
  })
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.code === 'knowledge.stale'), true)
})

test('admission rejects a verified capability without product outcome alignment', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-okf-outcome-'))
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  await cp(knowledgeRoot, temporaryRoot, { recursive: true })
  const capabilityPath = path.join(temporaryRoot, 'capabilities/github/search-public-repositories.md')
  const source = await readFile(capabilityPath, 'utf8')
  await writeFile(capabilityPath, source.replace(/^outcomes:.*\n/m, ''))
  const result = await validateKnowledgeBundle({ root: temporaryRoot, contractRoot, now: verificationTime })
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.code === 'capability.outcome-missing'), true)
})

test('admission rejects identity-required verification without identity bindings', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-okf-identity-'))
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  await cp(knowledgeRoot, temporaryRoot, { recursive: true })
  const reportPath = path.join(temporaryRoot, 'verifications/xiaohongshu/owned-notes/report.json')
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  delete report.identityRef
  delete report.identityPoolRef
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  const result = await validateKnowledgeBundle({ root: temporaryRoot, contractRoot, now: verificationTime })
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.code === 'probe.identity-missing'), true)
})

test('co-located connector definition stays hidden from public knowledge', async () => {
  const schema = JSON.parse(await readFile(path.join(contractRoot, 'connector-definition.schema.json'), 'utf8'))
  const definition = {
    schemaVersion: 'dsh.connector-definition/v1',
    id: 'example-hidden-connector',
    version: '1.0.0',
    capabilityRefs: ['/capabilities/example/read.md'],
    execution: { kind: 'deterministic', runtime: 'node', entrypoint: 'connectors/example-hidden-connector/src/index.mjs' },
    configSchema: 'knowledge/schemas/example/read-input.schema.json',
    credentialSlots: [{ name: 'account', required: true, purpose: 'authorized probe account' }],
    handlers: [{ capabilityRef: '/capabilities/example/read.md', operation: 'read' }],
    conformance: { status: 'verified', probeReportRef: '/references/verification/example.json' },
  }
  const ajv = new Ajv2020({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  assert.equal(validate(definition), true, JSON.stringify(validate.errors))
  assert.equal(JSON.stringify(definition).includes('secret'), false)
})

test('probe identity contract accepts only opaque credential references', async () => {
  const schema = JSON.parse(await readFile(path.join(contractRoot, 'probe-identity.schema.json'), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const identity = {
    schemaVersion: 'dsh.probe-identity/v1',
    id: 'provider-sandbox-01',
    subjectRef: '/platforms/example.md',
    kind: 'provider-sandbox',
    ownership: 'provider',
    credentialRef: 'credential:probe/example/sandbox-01',
    environment: 'sandbox',
    purpose: 'contract-authorized capability conformance',
    allowedCapabilityRefs: ['/capabilities/example/read.md'],
    termsEvidenceRefs: ['contract:example-sandbox'],
    lifecycle: { state: 'active', createdAt: '2026-08-26T00:00:00Z' },
    restrictions: {
      noRiskEvasion: true,
      noCrossIdentityCorrelation: true,
      noThirdPartyImpersonation: true,
    },
  }
  assert.equal(validate(identity), true, JSON.stringify(validate.errors))
  assert.equal(validate({ ...identity, credentialRef: 'plain-secret' }), false)
  assert.equal(validate({ ...identity, email: 'someone@example.com' }), false)
})

import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { FeedbackIntakeLocalStore } from '../connectors/feedback-intake-local-store/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/feedback-intake-local-store-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const sourceEvidence = []

for (const source of sourceCatalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-feedback-intake-local-storage-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8')
  for (const assertion of source.observation.assertions) if (!text.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
  sourceEvidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const revisionPath = path.join(repositoryRoot, 'knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json')
const { fixture: _fixture, ...revision } = JSON.parse(await readFile(revisionPath, 'utf8'))
const revisionRef = 'repo:/knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json'
const storeRef = 'feedback-store:owner-primary'
const publicInput = {
  storeRef,
  intakeRevisionRef: revisionRef,
  intakeRevisionHash: revision.intakeRevisionHash,
  reviewGrantRef: 'review-grant:probe-feedback-intake-01',
  idempotencyKey: 'probe-feedback-intake-01',
}
const probeNow = () => new Date('2026-08-27T09:40:00Z')

function createStore(root, { resolvedRevision = revision, grantOverride = {} } = {}) {
  return new FeedbackIntakeLocalStore({
    root,
    storeRef,
    now: probeNow,
    resolveIntakeRevision: async (ref) => {
      if (ref !== revisionRef) throw new Error('probe resolver received an unexpected revision ref')
      return structuredClone(resolvedRevision)
    },
    verifyReviewGrant: async (request) => ({
      authorized: true,
      capabilityId: request.capabilityId,
      effect: request.effect,
      storeRef: request.storeRef,
      intakeRevisionHash: request.intakeRevisionHash,
      grantReceiptRef: 'probe-review-receipt:feedback-intake-01',
      authorizedAt: '2026-08-27T09:39:00Z',
      expiresAt: '2026-08-27T10:00:00Z',
      ...grantOverride,
    }),
  })
}

const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/persist-consented-intake-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/persist-consented-intake-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(publicInput)) throw new Error(`feedback intake storage input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const roots = []
const temporaryRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knowledge-feedback-intake-probe-'))
  roots.push(root)
  return root
}

let firstReceipt
let envelopeDigest
try {
  const mainRoot = await temporaryRoot()
  const mainStore = createStore(mainRoot)
  firstReceipt = await mainStore.persist(publicInput)
  if (!validateOutput(firstReceipt)) throw new Error(`feedback intake storage output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
  if (firstReceipt.replayed || !firstReceipt.stored || firstReceipt.withdrawalApplied || firstReceipt.replySent || firstReceipt.platformWritten || firstReceipt.knowledgeWritten || firstReceipt.executionAuthorized) throw new Error('feedback intake storage receipt effect boundary mismatch')

  const files = await mainStore.listRecordFilesForVerification()
  if (files.length !== 1) throw new Error('feedback intake storage did not create exactly one record')
  const recordPath = path.join(mainRoot, 'records', files[0])
  const envelopeBytes = await readFile(recordPath)
  const envelope = JSON.parse(envelopeBytes.toString('utf8'))
  envelopeDigest = sha256(envelopeBytes)
  if (envelope.record.intakeRevisionHash !== revision.intakeRevisionHash || envelope.receipt.recordDigest !== firstReceipt.recordDigest) throw new Error('stored envelope does not bind the exact intake revision and receipt')
  if ((await lstat(recordPath)).mode & 0o777 ^ 0o600) throw new Error('stored envelope is not private mode 0600')

  const replay = await mainStore.persist(publicInput)
  if (!replay.replayed || replay.receiptRef !== firstReceipt.receiptRef || replay.recordDigest !== firstReceipt.recordDigest || !validateOutput(replay)) throw new Error('exact replay did not reconcile to the original receipt')
  await Promise.all([
    mainStore.persist({ ...publicInput, idempotencyKey: 'changed-idempotency' }).then(() => { throw new Error('changed idempotency key was accepted') }, (error) => { if (!/different revision or idempotency key/.test(error.message)) throw error }),
    mainStore.persist({ ...publicInput, path: '/tmp/public-path-injection' }).then(() => { throw new Error('public path injection was accepted') }, (error) => { if (!/unsupported fields/.test(error.message)) throw error }),
  ])

  const concurrentRoot = await temporaryRoot()
  const concurrentStore = createStore(concurrentRoot)
  const concurrentReceipts = await Promise.all([concurrentStore.persist(publicInput), concurrentStore.persist(publicInput)])
  if (concurrentReceipts.map((item) => item.replayed).sort().join(',') !== 'false,true') throw new Error('concurrent replay did not produce one write and one replay')
  if ((await concurrentStore.listRecordFilesForVerification()).length !== 1) throw new Error('concurrent storage created more than one record')

  const untrustedRoot = await temporaryRoot()
  await createStore(untrustedRoot, { grantOverride: { authorized: false } }).persist(publicInput).then(() => { throw new Error('untrusted review grant was accepted') }, (error) => { if (!/grant was rejected/.test(error.message)) throw error })

  const tamperedRevision = structuredClone(revision)
  tamperedRevision.submission.answers[0].statement += ' tampered after review'
  const tamperedRoot = await temporaryRoot()
  await createStore(tamperedRoot, { resolvedRevision: tamperedRevision }).persist(publicInput).then(() => { throw new Error('tampered intake revision was accepted') }, (error) => { if (!/exact ready revision|canonical preparation/.test(error.message)) throw error })
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
}

for (const root of roots) {
  try {
    await readdir(root)
    throw new Error(`isolated feedback intake probe root was not removed: ${root}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const verificationDirectory = path.join(repositoryRoot, 'knowledge/verifications/feedback/intake-local-storage')
const snapshotPath = path.join(verificationDirectory, 'snapshot.json')
const reportPath = path.join(verificationDirectory, 'report.json')
await mkdir(verificationDirectory, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'isolated-consented-feedback-intake-storage', ...firstReceipt }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `feedback-intake-local-storage-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/persist-consented-intake-revision.md',
  connectorId: 'feedback-intake-local-store',
  probeDefinitionRef: 'repo:/probes/definitions/feedback-intake-local-storage-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-storage-and-privacy-sources', status: 'passed' },
    { id: 'verified-intake-revision-chain', status: 'passed' },
    { id: 'exact-trusted-review-grant', status: 'passed' },
    { id: 'private-atomic-envelope', status: 'passed' },
    { id: 'idempotent-and-concurrent-replay', status: 'passed' },
    { id: 'conflict-path-and-tamper-rejection', status: 'passed' },
    { id: 'public-input-and-receipt-schema', status: 'passed' },
    { id: 'isolated-store-cleanup', status: 'passed' },
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json', sha256: sha256(await readFile(revisionPath)) },
    { kind: 'test-output', ref: 'probe:isolated-feedback-intake-envelope', sha256: envelopeDigest },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/intake-local-storage/snapshot.json', sha256: sha256(await readFile(snapshotPath)) },
  ],
  sideEffects: [{ effect: 'local-write', status: 'cleaned' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

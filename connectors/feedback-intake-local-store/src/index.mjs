import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { prepareConsentedFeedbackIntakeRevision } from '../../consented-feedback-intake-revision/src/index.mjs'

const CAPABILITY_ID = 'feedback.persist-consented-intake-revision'
const INPUT_KEYS = new Set(['storeRef', 'intakeRevisionRef', 'intakeRevisionHash', 'reviewGrantRef', 'idempotencyKey'])
const GRANT_KEYS = new Set(['authorized', 'capabilityId', 'effect', 'storeRef', 'intakeRevisionHash', 'grantReceiptRef', 'authorizedAt', 'expiresAt'])
const REVISION_KEYS = new Set(['schemaVersion', 'scope', 'submission', 'consent', 'privacyReview', 'retention', 'preparedAt', 'evidenceRefs', 'reviewItems', 'humanReviewRequired', 'reviewerDecision', 'stored', 'receiptIssued', 'withdrawalApplied', 'replySent', 'knowledgeWritten', 'executionAuthorized', 'status', 'intakeRevisionHash', 'preflight'])
const ID = /^[a-z][a-z0-9._:-]{0,127}$/
const DIGEST = /^sha256:[0-9a-f]{64}$/
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

const digest = (value) => `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`
const hexDigest = (value) => createHash('sha256').update(value).digest('hex')

function assertRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertExactKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`)
}

function opaque(value, name) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) throw new Error(`${name} must be a bounded opaque reference`)
  return value
}

function date(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${name} must be RFC 3339`)
  return new Date(value).toISOString()
}

function normalizeInput(input) {
  assertRecord(input, 'input')
  assertExactKeys(input, INPUT_KEYS, 'input')
  if (!ID.test(input.storeRef ?? '')) throw new Error('storeRef is invalid')
  if (!DIGEST.test(input.intakeRevisionHash ?? '')) throw new Error('intakeRevisionHash is invalid')
  if (!IDEMPOTENCY.test(input.idempotencyKey ?? '')) throw new Error('idempotencyKey is invalid')
  return {
    storeRef: input.storeRef,
    intakeRevisionRef: opaque(input.intakeRevisionRef, 'intakeRevisionRef'),
    intakeRevisionHash: input.intakeRevisionHash,
    reviewGrantRef: opaque(input.reviewGrantRef, 'reviewGrantRef'),
    idempotencyKey: input.idempotencyKey,
  }
}

function preparationInputFromRevision(revision) {
  return {
    scope: revision.scope,
    submission: {
      ...revision.submission,
      answers: revision.submission?.answers?.map(({ contentDigest: _contentDigest, ...answer }) => answer),
    },
    consent: revision.consent,
    privacyReview: revision.privacyReview,
    retention: revision.retention,
    preparedAt: revision.preparedAt,
    evidenceRefs: revision.evidenceRefs,
  }
}

function verifyResolvedRevision(raw, expectedHash) {
  assertRecord(raw, 'resolved intake revision')
  assertExactKeys(raw, REVISION_KEYS, 'resolved intake revision')
  const prepared = prepareConsentedFeedbackIntakeRevision(preparationInputFromRevision(raw))
  if (prepared.status !== 'ready-for-human-review' || prepared.intakeRevisionHash !== expectedHash) throw new Error('resolved intake revision is not the exact ready revision')
  if (stableStringify(prepared) !== stableStringify(raw)) throw new Error('resolved intake revision payload does not match its canonical preparation')
  return prepared
}

function verifyGrant(raw, expected, now) {
  assertRecord(raw, 'verified review grant')
  assertExactKeys(raw, GRANT_KEYS, 'verified review grant')
  if (raw.authorized !== true) throw new Error('trusted review grant was rejected')
  if (raw.capabilityId !== CAPABILITY_ID || raw.effect !== 'local-write') throw new Error('review grant capability or effect does not match')
  if (raw.storeRef !== expected.storeRef || raw.intakeRevisionHash !== expected.intakeRevisionHash) throw new Error('review grant binding does not match')
  const authorizedAt = date(raw.authorizedAt, 'verified review grant.authorizedAt')
  const expiresAt = date(raw.expiresAt, 'verified review grant.expiresAt')
  if (Date.parse(authorizedAt) > now.getTime() || Date.parse(expiresAt) <= now.getTime()) throw new Error('review grant is not currently valid')
  return { grantReceiptRef: opaque(raw.grantReceiptRef, 'verified review grant.grantReceiptRef'), authorizedAt, expiresAt }
}

async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const stat = await lstat(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('feedback intake store directory must be a real directory')
}

async function readEnvelope(target) {
  let raw
  try { raw = await readFile(target, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  let envelope
  try { envelope = JSON.parse(raw) } catch { throw new Error('stored feedback intake envelope is malformed') }
  if (envelope?.schemaVersion !== 'dsh.feedback-intake-storage-envelope/v1' || !envelope.record || !envelope.receipt) throw new Error('stored feedback intake envelope is unsupported')
  if (envelope.recordDigest !== digest(envelope.record)) throw new Error('stored feedback intake record integrity mismatch')
  if (envelope.receipt.recordDigest !== envelope.recordDigest) throw new Error('stored feedback intake receipt integrity mismatch')
  return envelope
}

function reconcileExisting(envelope, input, revision) {
  const expected = {
    storeRef: input.storeRef,
    intakeRevisionRef: input.intakeRevisionRef,
    intakeRevisionHash: input.intakeRevisionHash,
    idempotencyKey: input.idempotencyKey,
    submissionRef: revision.submission.submissionRef,
  }
  for (const [key, value] of Object.entries(expected)) if (envelope.record[key] !== value) throw new Error('submission is already stored under a different revision or idempotency key')
  if (stableStringify(envelope.record.intakeRevision) !== stableStringify(revision)) throw new Error('stored feedback intake revision payload does not match')
  return { ...envelope.receipt, replayed: true }
}

async function commitEnvelope(recordsRoot, target, envelope, maximumRecordBytes) {
  const bytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`)
  if (bytes.byteLength > maximumRecordBytes) throw new Error('feedback intake storage envelope exceeds maximumRecordBytes')
  const temporary = path.join(recordsRoot, `.${path.basename(target)}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = null
    try {
      await link(temporary, target)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      return false
    }
    const directoryHandle = await open(recordsRoot, 'r')
    try { await directoryHandle.sync() } finally { await directoryHandle.close() }
    return true
  } finally {
    if (handle) await handle.close().catch(() => {})
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

export class FeedbackIntakeLocalStore {
  constructor({ root, storeRef, maximumRecordBytes = 131072, resolveIntakeRevision, verifyReviewGrant, now = () => new Date() } = {}) {
    if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('feedback intake store root must be an absolute configured path')
    if (!ID.test(storeRef ?? '')) throw new Error('configured storeRef is invalid')
    if (!Number.isSafeInteger(maximumRecordBytes) || maximumRecordBytes < 4096 || maximumRecordBytes > 1048576) throw new Error('maximumRecordBytes must be between 4096 and 1048576')
    if (typeof resolveIntakeRevision !== 'function') throw new Error('resolveIntakeRevision is required')
    if (typeof verifyReviewGrant !== 'function') throw new Error('verifyReviewGrant is required')
    this.root = path.resolve(root)
    this.storeRef = storeRef
    this.maximumRecordBytes = maximumRecordBytes
    this.resolveIntakeRevision = resolveIntakeRevision
    this.verifyReviewGrant = verifyReviewGrant
    this.now = now
  }

  async persist(input) {
    const normalized = normalizeInput(input)
    if (normalized.storeRef !== this.storeRef) throw new Error('storeRef does not match configured local store')
    const now = this.now()
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('now must return a valid Date')
    const revision = verifyResolvedRevision(await this.resolveIntakeRevision(normalized.intakeRevisionRef), normalized.intakeRevisionHash)
    if (Date.parse(revision.retention.deleteAfter) <= now.getTime()) throw new Error('feedback intake retention deadline has expired')
    const grant = verifyGrant(await this.verifyReviewGrant({
      reviewGrantRef: normalized.reviewGrantRef,
      capabilityId: CAPABILITY_ID,
      effect: 'local-write',
      storeRef: normalized.storeRef,
      intakeRevisionHash: normalized.intakeRevisionHash,
    }), normalized, now)

    await ensurePrivateDirectory(this.root)
    const recordsRoot = path.join(this.root, 'records')
    await ensurePrivateDirectory(recordsRoot)
    const target = path.join(recordsRoot, `${hexDigest(revision.submission.submissionRef)}.json`)
    const existing = await readEnvelope(target)
    if (existing) return reconcileExisting(existing, normalized, revision)

    const storedAt = now.toISOString()
    const record = {
      schemaVersion: 'dsh.feedback-intake-stored-record/v1',
      storeRef: normalized.storeRef,
      intakeRevisionRef: normalized.intakeRevisionRef,
      intakeRevisionHash: normalized.intakeRevisionHash,
      idempotencyKey: normalized.idempotencyKey,
      submissionRef: revision.submission.submissionRef,
      intakeRevision: revision,
      reviewGrantReceiptRef: grant.grantReceiptRef,
      reviewAuthorizedAt: grant.authorizedAt,
      storedAt,
      deleteAfter: revision.retention.deleteAfter,
      withdrawalMechanismRef: revision.consent.withdrawalMechanismRef,
    }
    const recordDigest = digest(record)
    const receipt = {
      schemaVersion: 'dsh.feedback-intake-storage-receipt/v1',
      status: 'stored',
      receiptRef: `feedback-intake-storage:${hexDigest(stableStringify({ storeRef: normalized.storeRef, submissionRef: revision.submission.submissionRef, intakeRevisionHash: normalized.intakeRevisionHash }))}`,
      storeRef: normalized.storeRef,
      intakeRevisionRef: normalized.intakeRevisionRef,
      intakeRevisionHash: normalized.intakeRevisionHash,
      recordDigest,
      storedAt,
      deleteAfter: revision.retention.deleteAfter,
      withdrawalMechanismRef: revision.consent.withdrawalMechanismRef,
      reviewGrantReceiptRef: grant.grantReceiptRef,
      idempotencyKey: normalized.idempotencyKey,
      replayed: false,
      stored: true,
      withdrawalApplied: false,
      replySent: false,
      platformWritten: false,
      knowledgeWritten: false,
      executionAuthorized: false,
    }
    const envelope = { schemaVersion: 'dsh.feedback-intake-storage-envelope/v1', record, recordDigest, receipt }
    if (await commitEnvelope(recordsRoot, target, envelope, this.maximumRecordBytes)) return receipt
    const concurrent = await readEnvelope(target)
    if (!concurrent) throw new Error('feedback intake commit lost concurrent result')
    return reconcileExisting(concurrent, normalized, revision)
  }

  async listRecordFilesForVerification() {
    const recordsRoot = path.join(this.root, 'records')
    try { return (await readdir(recordsRoot)).filter((name) => name.endsWith('.json')).sort() } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }
}

export async function persistConsentedFeedbackIntakeRevision(input, dependencies) {
  return new FeedbackIntakeLocalStore(dependencies).persist(input)
}

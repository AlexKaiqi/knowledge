import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'

const CAPABILITY_ID = 'feedback.withdraw-consented-intake-record'
const INPUT_KEYS = new Set(['storeRef', 'storageReceiptRef', 'recordDigest', 'withdrawalRequestRef', 'withdrawalMechanismRef', 'withdrawalGrantRef', 'idempotencyKey'])
const GRANT_KEYS = new Set(['authorized', 'capabilityId', 'effect', 'storeRef', 'storageReceiptRef', 'recordDigest', 'withdrawalRequestRef', 'withdrawalMechanismRef', 'grantReceiptRef', 'authorizedAt', 'expiresAt'])
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
  if (!DIGEST.test(input.recordDigest ?? '')) throw new Error('recordDigest is invalid')
  if (!IDEMPOTENCY.test(input.idempotencyKey ?? '')) throw new Error('idempotencyKey is invalid')
  return {
    storeRef: input.storeRef,
    storageReceiptRef: opaque(input.storageReceiptRef, 'storageReceiptRef'),
    recordDigest: input.recordDigest,
    withdrawalRequestRef: opaque(input.withdrawalRequestRef, 'withdrawalRequestRef'),
    withdrawalMechanismRef: opaque(input.withdrawalMechanismRef, 'withdrawalMechanismRef'),
    withdrawalGrantRef: opaque(input.withdrawalGrantRef, 'withdrawalGrantRef'),
    idempotencyKey: input.idempotencyKey,
  }
}

async function assertRealDirectory(directory, name, { create = false } = {}) {
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 })
  let stat
  try { stat = await lstat(directory) } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${name} does not exist`)
    throw error
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${name} must be a real directory`)
}

async function syncDirectory(directory) {
  const handle = await open(directory, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

async function readBoundedJson(filePath, maximumBytes, name) {
  const stat = await lstat(filePath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${name} must be a regular file`)
  if (stat.size > maximumBytes) throw new Error(`${name} exceeds maximumEnvelopeBytes`)
  let parsed
  try { parsed = JSON.parse(await readFile(filePath, 'utf8')) } catch { throw new Error(`${name} is malformed`) }
  return parsed
}

function verifyStoredEnvelope(envelope) {
  if (envelope?.schemaVersion !== 'dsh.feedback-intake-storage-envelope/v1' || !envelope.record || !envelope.receipt) throw new Error('stored feedback intake envelope is unsupported')
  if (envelope.recordDigest !== digest(envelope.record)) throw new Error('stored feedback intake record integrity mismatch')
  if (envelope.receipt.recordDigest !== envelope.recordDigest) throw new Error('stored feedback intake receipt integrity mismatch')
  return envelope
}

function verifyStorageBinding(envelope, input) {
  const receipt = envelope.receipt
  if (receipt.schemaVersion !== 'dsh.feedback-intake-storage-receipt/v1' || receipt.status !== 'stored' || receipt.stored !== true) throw new Error('storage receipt is not a supported stored receipt')
  if (receipt.receiptRef !== input.storageReceiptRef || receipt.storeRef !== input.storeRef || receipt.recordDigest !== input.recordDigest) throw new Error('storage receipt binding does not match withdrawal request')
  if (receipt.withdrawalMechanismRef !== input.withdrawalMechanismRef) throw new Error('withdrawal mechanism does not match storage receipt')
  return receipt
}

function verifyGrant(raw, input, intakeRevisionHash, now) {
  assertRecord(raw, 'verified withdrawal grant')
  assertExactKeys(raw, GRANT_KEYS, 'verified withdrawal grant')
  if (raw.authorized !== true) throw new Error('trusted withdrawal grant was rejected')
  if (raw.capabilityId !== CAPABILITY_ID || raw.effect !== 'local-write') throw new Error('withdrawal grant capability or effect does not match')
  for (const key of ['storeRef', 'storageReceiptRef', 'recordDigest', 'withdrawalRequestRef', 'withdrawalMechanismRef']) if (raw[key] !== input[key]) throw new Error('withdrawal grant binding does not match')
  const authorizedAt = date(raw.authorizedAt, 'verified withdrawal grant.authorizedAt')
  const expiresAt = date(raw.expiresAt, 'verified withdrawal grant.expiresAt')
  if (Date.parse(authorizedAt) > now.getTime() || Date.parse(expiresAt) <= now.getTime()) throw new Error('withdrawal grant is not currently valid')
  return { grantReceiptRef: opaque(raw.grantReceiptRef, 'verified withdrawal grant.grantReceiptRef'), authorizedAt, expiresAt, intakeRevisionHash }
}

async function findStoredRecord(recordsRoot, input, maximumRecords, maximumEnvelopeBytes) {
  const entries = (await readdir(recordsRoot, { withFileTypes: true })).filter((entry) => entry.name.endsWith('.json'))
  if (entries.length > maximumRecords) throw new Error('feedback intake store exceeds maximumRecords scan budget')
  const matches = []
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('feedback intake record set contains a non-regular entry')
    const filePath = path.join(recordsRoot, entry.name)
    const envelope = verifyStoredEnvelope(await readBoundedJson(filePath, maximumEnvelopeBytes, 'stored feedback intake envelope'))
    if (envelope.receipt.receiptRef === input.storageReceiptRef) matches.push({ filePath, envelope })
  }
  if (matches.length === 0) return null
  if (matches.length > 1) throw new Error('storage receipt resolves to multiple feedback intake records')
  verifyStorageBinding(matches[0].envelope, input)
  return matches[0]
}

async function writeExclusive(directory, target, value, maximumBytes) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  if (bytes.byteLength > maximumBytes) throw new Error('withdrawal journal exceeds maximumEnvelopeBytes')
  const temporary = path.join(directory, `.${path.basename(target)}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = null
    try { await link(temporary, target) } catch (error) {
      if (error.code !== 'EEXIST') throw error
      return false
    }
    await syncDirectory(directory)
    return true
  } finally {
    if (handle) await handle.close().catch(() => {})
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

async function replaceDurably(directory, target, value, maximumBytes) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  if (bytes.byteLength > maximumBytes) throw new Error('withdrawal receipt exceeds maximumEnvelopeBytes')
  const temporary = path.join(directory, `.${path.basename(target)}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporary, target)
    await syncDirectory(directory)
  } finally {
    if (handle) await handle.close().catch(() => {})
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

function verifyJournal(journal, input) {
  if (journal?.schemaVersion !== 'dsh.feedback-intake-withdrawal-transaction/v1' || !['pending', 'committed'].includes(journal.state) || !journal.request || !journal.storage || !journal.grant) throw new Error('feedback withdrawal journal is unsupported')
  const { transactionDigest, ...payload } = journal
  if (transactionDigest !== digest(payload)) throw new Error('feedback withdrawal journal integrity mismatch')
  for (const key of Object.keys(input)) if (journal.request[key] !== input[key]) throw new Error('storage receipt already has a different withdrawal transaction')
  if (journal.storage.storageReceiptRef !== input.storageReceiptRef || journal.storage.recordDigest !== input.recordDigest) throw new Error('withdrawal journal storage binding does not match')
  if (journal.state === 'committed' && !journal.receipt) throw new Error('committed withdrawal journal lacks a receipt')
  return journal
}

function buildReceipt(input, storage, grant, withdrawnAt) {
  return {
    schemaVersion: 'dsh.feedback-intake-withdrawal-receipt/v1',
    status: 'withdrawn',
    withdrawalReceiptRef: `feedback-intake-withdrawal:${hexDigest(stableStringify({ storageReceiptRef: input.storageReceiptRef, withdrawalRequestRef: input.withdrawalRequestRef }))}`,
    storeRef: input.storeRef,
    storageReceiptRef: input.storageReceiptRef,
    intakeRevisionHash: storage.intakeRevisionHash,
    recordDigest: input.recordDigest,
    withdrawalRequestRef: input.withdrawalRequestRef,
    withdrawalMechanismRef: input.withdrawalMechanismRef,
    withdrawalGrantReceiptRef: grant.grantReceiptRef,
    withdrawnAt,
    idempotencyKey: input.idempotencyKey,
    replayed: false,
    recordPresent: false,
    logicalDeletionApplied: true,
    mediaSanitized: false,
    backupsPurged: false,
    downstreamCopiesDeleted: false,
    withdrawalApplied: true,
    replySent: false,
    platformWritten: false,
    knowledgeWritten: false,
    executionAuthorized: false,
  }
}

export class FeedbackIntakeLocalWithdrawal {
  constructor({ root, storeRef, maximumRecords = 10000, maximumEnvelopeBytes = 131072, verifyWithdrawalGrant, now = () => new Date(), onPhase = async () => {} } = {}) {
    if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('feedback intake store root must be an absolute configured path')
    if (!ID.test(storeRef ?? '')) throw new Error('configured storeRef is invalid')
    if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 1 || maximumRecords > 100000) throw new Error('maximumRecords must be between 1 and 100000')
    if (!Number.isSafeInteger(maximumEnvelopeBytes) || maximumEnvelopeBytes < 4096 || maximumEnvelopeBytes > 1048576) throw new Error('maximumEnvelopeBytes must be between 4096 and 1048576')
    if (typeof verifyWithdrawalGrant !== 'function') throw new Error('verifyWithdrawalGrant is required')
    if (typeof onPhase !== 'function') throw new Error('onPhase must be a function')
    this.root = path.resolve(root)
    this.storeRef = storeRef
    this.maximumRecords = maximumRecords
    this.maximumEnvelopeBytes = maximumEnvelopeBytes
    this.verifyWithdrawalGrant = verifyWithdrawalGrant
    this.now = now
    this.onPhase = onPhase
  }

  async withdraw(input) {
    const normalized = normalizeInput(input)
    if (normalized.storeRef !== this.storeRef) throw new Error('storeRef does not match configured local store')
    const now = this.now()
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('now must return a valid Date')
    await assertRealDirectory(this.root, 'feedback intake store root')
    const recordsRoot = path.join(this.root, 'records')
    await assertRealDirectory(recordsRoot, 'feedback intake records directory')
    const withdrawalsRoot = path.join(this.root, 'withdrawals')
    let withdrawalsDirectoryExists = true
    try { await assertRealDirectory(withdrawalsRoot, 'feedback intake withdrawals directory') } catch (error) {
      if (/withdrawals directory does not exist$/.test(error.message)) withdrawalsDirectoryExists = false
      else throw error
    }
    const journalPath = path.join(withdrawalsRoot, `${hexDigest(normalized.storageReceiptRef)}.json`)

    let journal
    let journalCreated = false
    if (withdrawalsDirectoryExists) {
      try { journal = verifyJournal(await readBoundedJson(journalPath, this.maximumEnvelopeBytes, 'feedback withdrawal journal'), normalized) } catch (error) {
        if (error.code !== 'ENOENT' && !/does not exist$/.test(error.message)) throw error
      }
    }

    let located = null
    if (!journal || journal.state === 'pending') located = await findStoredRecord(recordsRoot, normalized, this.maximumRecords, this.maximumEnvelopeBytes)
    if (!journal && !located) throw new Error('storage receipt record is absent and no withdrawal transaction proves its removal')
    const intakeRevisionHash = journal?.storage.intakeRevisionHash ?? located.envelope.receipt.intakeRevisionHash
    const grant = verifyGrant(await this.verifyWithdrawalGrant({
      withdrawalGrantRef: normalized.withdrawalGrantRef,
      capabilityId: CAPABILITY_ID,
      effect: 'local-write',
      storeRef: normalized.storeRef,
      storageReceiptRef: normalized.storageReceiptRef,
      recordDigest: normalized.recordDigest,
      withdrawalRequestRef: normalized.withdrawalRequestRef,
      withdrawalMechanismRef: normalized.withdrawalMechanismRef,
    }), normalized, intakeRevisionHash, now)

    if (journal?.state === 'committed') return { ...journal.receipt, replayed: true }
    if (!journal) {
      if (!withdrawalsDirectoryExists) {
        await assertRealDirectory(withdrawalsRoot, 'feedback intake withdrawals directory', { create: true })
        withdrawalsDirectoryExists = true
      }
      const payload = {
        schemaVersion: 'dsh.feedback-intake-withdrawal-transaction/v1',
        state: 'pending',
        request: normalized,
        storage: { storageReceiptRef: normalized.storageReceiptRef, intakeRevisionHash, recordDigest: normalized.recordDigest },
        grant,
        startedAt: now.toISOString(),
      }
      const candidate = { ...payload, transactionDigest: digest(payload) }
      if (await writeExclusive(withdrawalsRoot, journalPath, candidate, this.maximumEnvelopeBytes)) {
        journal = candidate
        journalCreated = true
      }
      else journal = verifyJournal(await readBoundedJson(journalPath, this.maximumEnvelopeBytes, 'feedback withdrawal journal'), normalized)
      await this.onPhase({ phase: 'pending-created' })
    }

    if (journal.state === 'committed') return { ...journal.receipt, replayed: true }
    if (journal.grant.grantReceiptRef !== grant.grantReceiptRef) throw new Error('withdrawal transaction is bound to a different trusted grant receipt')
    if (!located) located = await findStoredRecord(recordsRoot, normalized, this.maximumRecords, this.maximumEnvelopeBytes)
    if (located) {
      verifyStorageBinding(located.envelope, normalized)
      try {
        const current = await lstat(located.filePath)
        if (!current.isFile() || current.isSymbolicLink()) throw new Error('feedback intake record changed before withdrawal')
        await unlink(located.filePath)
        await syncDirectory(recordsRoot)
        await this.onPhase({ phase: 'record-unlinked' })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    const receipt = buildReceipt(normalized, journal.storage, journal.grant, journal.startedAt)
    const committedPayload = { ...journal, state: 'committed', receipt }
    delete committedPayload.transactionDigest
    const committed = { ...committedPayload, transactionDigest: digest(committedPayload) }
    await replaceDurably(withdrawalsRoot, journalPath, committed, this.maximumEnvelopeBytes)
    return { ...receipt, replayed: !journalCreated }
  }

  async listRecordFilesForVerification() {
    const recordsRoot = path.join(this.root, 'records')
    try { return (await readdir(recordsRoot)).filter((name) => name.endsWith('.json')).sort() } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  async listWithdrawalFilesForVerification() {
    const withdrawalsRoot = path.join(this.root, 'withdrawals')
    try { return (await readdir(withdrawalsRoot)).filter((name) => name.endsWith('.json')).sort() } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }
}

export async function withdrawConsentedFeedbackIntakeRecord(input, dependencies) {
  return new FeedbackIntakeLocalWithdrawal(dependencies).withdraw(input)
}

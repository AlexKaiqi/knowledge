import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareConsentedFeedbackIntakeRevision } from '../connectors/consented-feedback-intake-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceCatalog = JSON.parse(await readFile(path.join(repositoryRoot, 'collectors/consented-feedback-intake-revision-maintainer/sources.json'), 'utf8'))
const startedAt = new Date()
const sourceEvidence = []

for (const source of sourceCatalog.sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-consented-feedback-intake-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8')
  for (const assertion of source.observation.assertions) if (!text.includes(assertion.includes)) throw new Error(`${source.id} semantic missing: ${assertion.id}`)
  sourceEvidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputPath = path.join(repositoryRoot, 'probes/fixtures/feedback/consented-intake.json')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/prepare-consented-intake-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/feedback/prepare-consented-intake-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
if (!validateInput(input)) throw new Error(`feedback intake input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareConsentedFeedbackIntakeRevision(input)
const replay = prepareConsentedFeedbackIntakeRevision({ ...input, submission: { ...input.submission, answers: [...input.submission.answers].reverse() }, evidenceRefs: [...input.evidenceRefs].reverse() })
if (prepared.status !== 'ready-for-human-review' || prepared.intakeRevisionHash !== replay.intakeRevisionHash) throw new Error('feedback intake replay mismatch')

const variants = [
  { ...input, submission: { ...input.submission, answers: input.submission.answers.map((item) => item.fieldRef === 'difficulty' ? { ...item, statement: `${item.statement} Again.` } : item) } },
  { ...input, scope: { ...input.scope, decisionRef: 'decision:improve-retention' } },
  { ...input, consent: { ...input.consent, withdrawalMechanismRef: 'feedback-withdrawal:email-v1' } },
  { ...input, retention: { ...input.retention, deleteAfter: '2027-02-22T08:00:00Z' } },
]
for (const variant of variants) if (prepareConsentedFeedbackIntakeRevision(variant).intakeRevisionHash === prepared.intakeRevisionHash) throw new Error('feedback intake revision failed to bind an exact field')

const blocked = prepareConsentedFeedbackIntakeRevision({
  ...input,
  submission: { ...input.submission, purposeRefs: ['purpose:marketing'], answers: input.submission.answers.filter((item) => item.fieldRef !== 'workaround') },
  consent: { ...input.consent, status: 'withdrawn', noticeRevisionRef: 'privacy-notice:old', capturedAt: '2026-08-27T08:00:01Z', validUntil: '2026-08-27T08:00:30Z', otherPeopleData: 'unknown' },
  privacyReview: { ...input.privacyReview, status: 'requires-review', directIdentifiers: 'present', sensitiveData: 'unknown', reidentificationProhibited: false },
  retention: { ...input.retention, deleteAfter: '2028-08-27T08:00:00Z' },
})
const blockerCodes = new Set(blocked.preflight.blockers.map((item) => item.code))
for (const code of ['consent-not-current', 'consent-notice-mismatch', 'consent-captured-after-submission', 'consent-expired', 'other-people-data-unresolved', 'purpose-outside-scope', 'expected-answer-missing', 'privacy-review-incomplete', 'direct-identifiers-unresolved', 'sensitive-data-unresolved', 'reidentification-not-prohibited', 'retention-exceeds-policy']) if (!blockerCodes.has(code)) throw new Error(`feedback intake blocker missing: ${code}`)

if (!prepared.humanReviewRequired || prepared.reviewerDecision !== null || prepared.stored || prepared.receiptIssued || prepared.withdrawalApplied || prepared.replySent || prepared.knowledgeWritten || prepared.executionAuthorized) throw new Error('feedback intake effect boundary mismatch')
const validateOutput = ajv.compile(outputSchema)
if (!validateOutput(prepared)) throw new Error(`feedback intake output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!validateOutput(blocked)) throw new Error(`blocked feedback intake output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

const verificationDirectory = path.join(repositoryRoot, 'knowledge/verifications/feedback/consented-intake-review-revision')
const snapshotPath = path.join(verificationDirectory, 'snapshot.json')
const reportPath = path.join(verificationDirectory, 'report.json')
await mkdir(verificationDirectory, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'pet-assistant-consented-feedback-intake', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `consented-feedback-intake-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/feedback/prepare-consented-intake-review-revision.md',
  connectorId: 'consented-feedback-intake-revision',
  probeDefinitionRef: 'repo:/probes/definitions/consented-feedback-intake-review-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-privacy-boundaries', status: 'passed' },
    { id: 'input-schema', status: 'passed' },
    { id: 'exact-revision-binding', status: 'passed' },
    { id: 'consent-purpose-field-blockers', status: 'passed' },
    { id: 'privacy-retention-blockers', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-effect-boundary', status: 'passed' }
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'artifact', ref: 'repo:/probes/fixtures/feedback/consented-intake.json', sha256: sha256(await readFile(inputPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/feedback/consented-intake-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

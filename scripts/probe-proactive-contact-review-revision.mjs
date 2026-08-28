import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareProactiveContactReviewRevision } from '../connectors/proactive-contact-review-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'mira-companion-policy',
    url: 'https://raw.githubusercontent.com/Vexillon-ai/MIRA/91e128431c93d6efab5bcb450aa50b42df8f8a01/src/companion/policy.rs',
    digest: '26f860e0c0f259eecf34e4c2c8bdb6aaec4f08792a2aab04be7ebfb1c42e48d9',
    assertions: ['reason: "recent_user_activity"', 'reason: "min_gap"', 'reason: "daily_cap"', 'reason: "unanswered_cap"', 'reason: "quiet_hours"', 'reason: "not_due"'],
  },
  {
    id: 'mira-companion-settings',
    url: 'https://raw.githubusercontent.com/Vexillon-ai/MIRA/91e128431c93d6efab5bcb450aa50b42df8f8a01/src/companion/settings.rs',
    digest: '8a57768421b6ab5d8b4aeed0c49b4b4ee8a141fc32e6fa1d7cb349f34070daf7',
    assertions: ['enabled: false', 'paused_until', 'setup_completed_at', 'max_per_day'],
  },
  {
    id: 'vellum-deterministic-notification-checks',
    url: 'https://raw.githubusercontent.com/vellum-ai/vellum-assistant/bd79e0797681bfb2cf76f50d6f0bc2ad84e995e8/assistant/src/notifications/deterministic-checks.ts',
    digest: '9587739632d83cbe846023342937519cb92712cc5c2d1ba7e6585b447dd70aee',
    assertions: ['dedupeKey', 'dedupeWindowMs', 'already processed'],
  },
  {
    id: 'vellum-notification-contract',
    url: 'https://raw.githubusercontent.com/vellum-ai/vellum-assistant/bd79e0797681bfb2cf76f50d6f0bc2ad84e995e8/assistant/src/notifications/README.md',
    digest: '28b47a1e5fde59925b3c4316b79c32328781c32eff679bd8c99c707d5443973b',
    assertions: ['Source-Active Gate', 'visibleInSourceNow', 'same `dedupeKey` within the dedupe window'],
  },
  {
    id: 'android-notification-control',
    url: 'https://developer.android.com/develop/ui/compose/notifications?hl=en',
    assertions: ['let users control notification behaviors', 'avoid flooding your users with multiple or redundant notifications', 'Users can change the importance of a notification channel'],
  },
  {
    id: 'android-notification-permission',
    url: 'https://developer.android.com/develop/ui/compose/notifications/notification-permission?hl=en',
    assertions: ['POST_NOTIFICATIONS', 'App capabilities depend on user choice in permissions dialog', "Don't allow"],
  },
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { redirect: 'error', headers: { 'user-agent': 'knowledge-proactive-contact-probe/1.0' }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (source.digest && sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const input = {
  ownerScopeRef: 'owner:primary',
  policy: { optedIn: true, pausedUntil: null, timeZone: 'Asia/Shanghai', quietWindows: [{ start: '22:00', end: '08:00' }], minimumGapMinutes: 90, maximumPerDay: 3, maximumConsecutiveUnanswered: 2, recentActivitySuppressionMinutes: 60, dedupeWindowMinutes: 120 },
  state: { evaluatedAt: '2026-08-27T06:00:00Z', sentToday: 1, consecutiveUnanswered: 0, lastProactiveContactAt: '2026-08-27T03:00:00Z', lastUserActivityAt: '2026-08-27T04:00:00Z', recentDedupeObservations: [] },
  candidate: {
    candidateRef: 'proposal:feedback-follow-up-1', kind: 'follow-up', dedupeKey: 'feedback-follow-up:revision-1',
    basis: 'The user explicitly asked to revisit the feedback synthesis today.', evidenceRefs: ['request:fixture-1'], consequenceRefs: ['contract:proactive-contact-review-only'],
    surfaceRefs: ['surface:current-desktop'], availableFrom: '2026-08-27T05:00:00Z', expiresAt: '2026-08-27T10:00:00Z', visibleInSourceNow: false,
    copy: { title: 'Feedback follow-up', body: 'The feedback synthesis is ready to review when you have a moment.' },
  },
}
const prepared = prepareProactiveContactReviewRevision(input, { now: () => new Date('2026-08-27T06:01:00Z') })
const replay = prepareProactiveContactReviewRevision(input, { now: () => new Date('2026-08-28T06:01:00Z') })
if (prepared.status !== 'eligible-for-human-review' || prepared.reviewRevisionHash !== replay.reviewRevisionHash) throw new Error('eligible deterministic replay failed')
if (prepared.reviewItems.length !== 7 || !prepared.reviewItems.every((item) => item.status === 'pending')) throw new Error('human review boundary mismatch')
if (prepared.notificationSent || prepared.messageCreated || prepared.deliveryAttempted || prepared.executionAuthorized || prepared.reviewerDecision !== null) throw new Error('non-delivery boundary mismatch')

const quiet = structuredClone(input)
quiet.state = { ...quiet.state, evaluatedAt: '2026-08-27T15:30:00Z', lastProactiveContactAt: '2026-08-27T10:00:00Z', lastUserActivityAt: '2026-08-27T10:00:00Z' }
quiet.candidate.expiresAt = '2026-08-28T10:00:00Z'
if (!prepareProactiveContactReviewRevision(quiet).suppressionReasons.includes('quiet-hours')) throw new Error('wraparound quiet window was not enforced')
const suppressed = structuredClone(input)
suppressed.policy = { ...suppressed.policy, optedIn: false, pausedUntil: '2026-08-27T09:00:00Z', maximumPerDay: 1 }
suppressed.state = { ...suppressed.state, sentToday: 1, consecutiveUnanswered: 2, lastProactiveContactAt: '2026-08-27T05:45:00Z', lastUserActivityAt: '2026-08-27T05:50:00Z', recentDedupeObservations: [{ key: input.candidate.dedupeKey, observedAt: '2026-08-27T05:30:00Z' }] }
suppressed.candidate.visibleInSourceNow = true
const suppressedResult = prepareProactiveContactReviewRevision(suppressed)
for (const reason of ['not-opted-in', 'paused', 'visible-in-source', 'recent-user-activity', 'minimum-gap', 'daily-cap', 'unanswered-cap', 'duplicate-recent-contact']) if (!suppressedResult.suppressionReasons.includes(reason)) throw new Error(`suppression missing: ${reason}`)
const edited = structuredClone(input)
edited.candidate.copy.body += ' No action is required now.'
if (prepareProactiveContactReviewRevision(edited).reviewRevisionHash === prepared.reviewRevisionHash) throw new Error('copy mutation did not invalidate revision')

const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/prepare-proactive-contact-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(prepared)) throw new Error(`proactive contact output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/proactive-contact-review-revision/snapshot.json')
const reportPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/proactive-contact-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owner-opted-in-review-only-follow-up', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1', id: `proactive-contact-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/prepare-proactive-contact-review-revision.md', connectorId: 'proactive-contact-review-revision', probeDefinitionRef: 'repo:/probes/definitions/proactive-contact-review-revision-local.json',
  environment: 'local', level: 'local', outcome: 'passed', startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'pinned-proactive-policy-semantics', status: 'passed' }, { id: 'official-user-notification-control', status: 'passed' },
    { id: 'opt-in-pause-activity-frequency-unanswered-gates', status: 'passed' }, { id: 'source-visible-and-dedupe-gates', status: 'passed' },
    { id: 'iana-wraparound-quiet-window', status: 'passed' }, { id: 'copy-surface-timing-policy-state-binding', status: 'passed' },
    { id: 'output-schema', status: 'passed' }, { id: 'non-delivery-non-authorization-boundary', status: 'passed' }
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/proactive-contact-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

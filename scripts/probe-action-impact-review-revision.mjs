import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareActionImpactReviewRevision } from '../connectors/action-impact-review-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'social-workbench-confirmation-primitive',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/domain.mjs',
    digest: '20f1d35eef1c0be4121762ef2bf14443bf766db1dd9c0f962c38543d698eb47a',
    semantics: ["for (const key of ['revisionHash', 'platform', 'accountRef', 'visibility'])", "confirmation token has already been consumed", "confirmation token has expired"],
  },
  {
    id: 'pet-assistant-explicit-authorization',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-pet-assistant/77ea504f5267ac0f929d4fc81301f999899f270b/dsh/core.js',
    digest: 'ba5a0797aabcb0f7cdd1cef1585dc5974bd335e52ee98040fdb9d647d2c5fe46',
    semantics: ['Explicit delegation authorization is required in the current user message', 'args.confirmed !== true'],
  },
  {
    id: 'personal-knowledge-confirmation-flow',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json',
    digest: '5d2a81bda32184a2114c4ad525ce92c62302d5cf31074cc04ea0801bb2124bde',
    semantics: ['"flow": ["proposal", "explicit-confirmation", "atomic-write", "git-commit", "receipt"]', '"backgroundAgentMayConfirm": false'],
  },
  {
    id: 'oauth-resource-indicator',
    url: 'https://www.rfc-editor.org/rfc/rfc8707.html',
    semantics: ['most specific URI', 'invalid_target'],
  },
  {
    id: 'oauth-rich-authorization',
    url: 'https://www.rfc-editor.org/rfc/rfc9396.html',
    semantics: ['authorization_details', 'tampering and swapping'],
  },
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-action-review-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const observedDigest = sha256(body)
  if (source.digest && observedDigest !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: observedDigest })
}

const candidate = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/assistant/memory-action-grounding/snapshot.json'), 'utf8'))
if (candidate.readiness !== 'grounded' || candidate.executionAuthorized !== false) throw new Error('accepted Action Candidate is not a grounded non-authorizing input')
const input = {
  candidate: {
    candidateRef: 'repo:/knowledge/verifications/assistant/memory-action-grounding/snapshot.json',
    candidateDigest: candidate.resultDigest,
    actionName: candidate.actionName,
    effect: candidate.effect,
    scopeRef: candidate.scopeRef,
    targetRefs: ['channel:current'],
    arguments: candidate.candidateArguments,
    readiness: candidate.readiness,
    requiredMissing: candidate.requiredMissing,
  },
  impact: {
    dataClasses: ['personal'],
    audience: 'single-recipient',
    reversibility: 'reversible',
    cost: { kind: 'none' },
    consequenceRefs: ['contract:schedule-reminder'],
  },
  requestedAt: '2026-08-27T05:00:00Z',
  validForSeconds: 600,
  evidenceRefs: [`candidate:${candidate.resultDigest}`, 'contract:schedule-reminder'],
}

const prepared = prepareActionImpactReviewRevision(input)
const replay = prepareActionImpactReviewRevision(input)
if (prepared.status !== 'ready-for-human-review' || prepared.reviewRevisionHash !== replay.reviewRevisionHash) throw new Error('action review replay mismatch')
for (const variant of [
  { ...input, candidate: { ...input.candidate, arguments: { ...input.candidate.arguments, quietMode: false } } },
  { ...input, candidate: { ...input.candidate, targetRefs: ['channel:other'] } },
  { ...input, validForSeconds: 900 },
]) if (prepareActionImpactReviewRevision(variant).reviewRevisionHash === prepared.reviewRevisionHash) throw new Error('review revision failed to bind an exact field')

const incomplete = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, readiness: 'needs-clarification', requiredMissing: ['timezone'] } })
if (!incomplete.preflight.blockers.some((item) => item.code === 'candidate-needs-clarification')) throw new Error('incomplete candidate was not blocked')
const financial = prepareActionImpactReviewRevision({ ...input, candidate: { ...input.candidate, effect: 'financial' }, impact: { ...input.impact, audience: 'none', cost: { kind: 'unknown' } } })
if (financial.reviewClass !== 'critical' || !financial.reviewItems.some((item) => item.id === 'cost-ceiling')) throw new Error('financial impact was not escalated')
if (prepared.reviewerDecision !== null || prepared.authorizationGranted || prepared.confirmationTokenIssued || prepared.executionAuthorized) throw new Error('authorization boundary mismatch')

const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/prepare-action-impact-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(prepared)) throw new Error(`action review output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/action-impact-review-revision/snapshot.json')
const reportPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/action-impact-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'grounded-reminder-action-review', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `action-impact-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/assistant/prepare-action-impact-review-revision.md',
  connectorId: 'action-impact-review-revision',
  probeDefinitionRef: 'repo:/probes/definitions/action-impact-review-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'pinned-production-boundaries', status: 'passed' },
    { id: 'grounded-candidate-chain', status: 'passed' },
    { id: 'exact-revision-binding', status: 'passed' },
    { id: 'impact-escalation', status: 'passed' },
    { id: 'incomplete-candidate-blocker', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-authorization-boundary', status: 'passed' }
  ],
  evidence: [
    ...evidence,
    { kind: 'artifact', ref: 'repo:/knowledge/verifications/assistant/memory-action-grounding/snapshot.json', sha256: sha256(await readFile(path.join(repositoryRoot, 'knowledge/verifications/assistant/memory-action-grounding/snapshot.json'))) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/action-impact-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

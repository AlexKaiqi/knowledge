import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamContentSurveyReviewRevision } from '../connectors/steam-content-survey-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/steam-content-survey.json'), 'utf8'))
const sources = [
  {
    id: 'steam-content-survey',
    url: 'https://partner.steamgames.com/doc/gettingstarted/contentsurvey?language=english',
    assertions: [
      'Before submitting your store page and product build for review',
      'three primary sections that all must be completed',
      "You must disclose all the adult content you've uploaded in your builds",
      'Pre-Generated:',
      'Live-Generated:',
      "what kind of guardrails you're putting on your AI",
      'surveys cannot be edited without first contacting',
    ],
  },
  {
    id: 'steam-germany-age-rating',
    url: 'https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany?language=english',
    assertions: [
      'Steam will no longer display games to customers in Germany if the game is missing a valid age rating',
      "truthfully complete Steam's built-in content questionnaire",
      'If the generated rating allows',
    ],
  },
  {
    id: 'steam-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?language=english',
    assertions: [
      'Adult Only Sexual Content',
      'both the Store Page and Product Build must be completed and submitted for review',
      'Mark as ready for review',
    ],
  },
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-content-survey-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-content-survey-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-content-survey-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam Content Survey input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareSteamContentSurveyReviewRevision(fixture, { now: () => new Date('2026-08-27T10:30:00Z') })
const replay = prepareSteamContentSurveyReviewRevision(fixture, { now: () => new Date('2026-08-28T10:30:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic Content Survey revision replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam Content Survey output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.platformValidated || prepared.buildValidatedByConnector || prepared.submittedToSteamworks || prepared.ratingIssued || prepared.storefrontVisibilityChanged || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')

const mutations = [
  { ...fixture, buildRevisionRef: 'build:steam-public-candidate-v8' },
  { ...fixture, questionnaireRevisionRef: 'steam-content-survey:observed-next' },
]
const answerMutation = structuredClone(fixture); answerMutation.sections[0].answers[0].response.value = true; mutations.push(answerMutation)
const evidenceMutation = structuredClone(fixture); evidenceMutation.sections[0].answers[0].evidenceRefs.push('evidence:secondary-audit'); mutations.push(evidenceMutation)
const aiMutation = structuredClone(fixture); aiMutation.aiDisclosure.guardrailEvidenceRefs.push('guardrail:human-escalation-v1'); mutations.push(aiMutation)
for (const mutation of mutations) if (prepareSteamContentSurveyReviewRevision(mutation).revisionHash === prepared.revisionHash) throw new Error('Content Survey revision mutation was not bound')

const missingAnswer = structuredClone(fixture); missingAnswer.sections[0].answers.pop()
if (!prepareSteamContentSurveyReviewRevision(missingAnswer).preflight.blockers.some((item) => item.code === 'missing-question-answer')) throw new Error('missing question answer was not blocked')
const missingSection = structuredClone(fixture); missingSection.sections.pop()
if (!prepareSteamContentSurveyReviewRevision(missingSection).preflight.blockers.some((item) => item.code === 'missing-required-section')) throw new Error('missing section was not blocked')
const unconfirmedAdult = structuredClone(fixture); unconfirmedAdult.declarations.allUploadedAdultContentDisclosed = false
if (!prepareSteamContentSurveyReviewRevision(unconfirmedAdult).preflight.blockers.some((item) => item.code === 'adult-content-disclosure-unconfirmed')) throw new Error('unconfirmed adult-content disclosure was not blocked')
const missingGuardrails = structuredClone(fixture); missingGuardrails.aiDisclosure.guardrailEvidenceRefs = []
if (!prepareSteamContentSurveyReviewRevision(missingGuardrails).preflight.blockers.some((item) => item.detail === 'guardrail-evidence')) throw new Error('missing live-AI guardrails were not blocked')

const snapshotPath = path.join(root, 'knowledge/verifications/steam/content-survey-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/content-survey-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-game-content-survey-evidence', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-content-survey-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-content-survey-review-revision.md',
  connectorId: 'steam-content-survey-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-content-survey-review-revision-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-content-survey-semantics', status: 'passed' },
    { id: 'three-section-and-adult-disclosure-rules', status: 'passed' },
    { id: 'generative-ai-and-guardrail-rules', status: 'passed' },
    { id: 'germany-rating-visibility-boundary', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'questionnaire-build-answer-and-evidence-binding', status: 'passed' },
    { id: 'completeness-and-ai-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' },
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/content-survey-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, sections: prepared.sections.length, expiresAt: report.expiresAt }, null, 2))

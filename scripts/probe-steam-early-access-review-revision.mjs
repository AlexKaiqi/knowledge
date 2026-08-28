import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamEarlyAccessReviewRevision } from '../connectors/steam-early-access-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/steam-early-access.json'), 'utf8'))
const sources = [
  {
    id: 'steam-early-access',
    url: 'https://partner.steamgames.com/doc/store/earlyaccess?language=english',
    assertions: [
      'playable alpha or beta state',
      'Early Access is not a way to crowdfund development of your product',
      'Do not make specific promises about future events',
      'The Early Access price of your game should be no higher than that offered on any other service or website',
      "Don't launch in Early Access without a playable game",
      'Why Early Access?',
      'Approximately how long will this game be in Early Access?',
      'How is the full version planned to differ from the Early Access version?',
      'What is the current state of the Early Access version?',
      'Will the game be priced differently during and after Early Access?',
      'How are you planning on involving the Community in your development process?',
      'date picker to select a planned 1.0 release date',
      'There is not a specific field for you to enter your intended full release date',
    ],
  },
  {
    id: 'steam-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?language=english',
    assertions: [
      'answer all the questions in the Early Access section',
      'clear expectation of what the current version of your game contains',
      'what features and content still need to be added',
      'Mark as ready for review',
    ],
  },
  {
    id: 'steam-store-page',
    url: 'https://partner.steamgames.com/doc/store/page?language=english',
    assertions: [
      'check the box under the Early Access tab',
      'answer all the questions in that section',
      'required items for your store presence',
    ],
  },
]

const startedAt = new Date()
const evidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-early-access-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const text = body.toString('utf8').replace(/<[^>]+>/g, ' ').replaceAll('&quot;', '"').replaceAll('&amp;', '&').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!text.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  evidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-early-access-review-revision-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/steam/prepare-early-access-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`Steam Early Access input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const prepared = prepareSteamEarlyAccessReviewRevision(fixture, { now: () => new Date('2026-08-27T11:30:00Z') })
const replay = prepareSteamEarlyAccessReviewRevision(fixture, { now: () => new Date('2026-08-28T11:30:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic Early Access revision replay failed')
if (!validateOutput(prepared)) throw new Error(`Steam Early Access output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.platformValidated || prepared.buildValidatedByConnector || prepared.priceValidated || prepared.savedToSteamworks || prepared.published || prepared.markedReadyForReview || prepared.releasedAsEarlyAccess || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')

const mutations = [{ ...fixture, buildRevisionRef: 'build:steam-early-access-candidate-v5' }, { ...fixture, questionnaireRevisionRef: 'steam-early-access-qa:observed-next' }]
const answer = structuredClone(fixture); answer.answers[0].text += ' Revised.'; mutations.push(answer)
const feature = structuredClone(fixture); feature.currentBuild.currentFeatureRefs.push('feature:new-loop'); mutations.push(feature)
const price = structuredClone(fixture); price.pricePlan.futurePriceDirection = 'same'; mutations.push(price)
const disclosure = structuredClone(fixture); disclosure.thirdPartyDistribution.disclosureEvidenceRefs.push('disclosure:second-site'); mutations.push(disclosure)
for (const mutation of mutations) if (prepareSteamEarlyAccessReviewRevision(mutation).revisionHash === prepared.revisionHash) throw new Error('Early Access revision mutation was not bound')

const missing = structuredClone(fixture); missing.answers.pop()
if (!prepareSteamEarlyAccessReviewRevision(missing).preflight.blockers.some((item) => item.code === 'missing-question-answer')) throw new Error('missing Q&A answer was not blocked')
const unplayable = structuredClone(fixture); unplayable.currentBuild.playabilityState = 'not-playable'
if (!prepareSteamEarlyAccessReviewRevision(unplayable).preflight.blockers.some((item) => item.code === 'current-build-not-playable')) throw new Error('non-playable build was not blocked')
const promise = structuredClone(fixture); promise.eligibility.futurePlanCommitment = 'specific-promises'
if (!prepareSteamEarlyAccessReviewRevision(promise).preflight.blockers.some((item) => item.code === 'specific-future-promises')) throw new Error('specific future promises were not blocked')
const funding = structuredClone(fixture); funding.eligibility.fundingDependency = 'dependent-on-early-access-sales'
if (!prepareSteamEarlyAccessReviewRevision(funding).preflight.blockers.some((item) => item.code === 'completion-depends-on-early-access-sales')) throw new Error('sales-dependent completion was not blocked')
const parity = structuredClone(fixture); parity.pricePlan.steamPriceParity = 'higher-than-other-service'
if (!prepareSteamEarlyAccessReviewRevision(parity).preflight.blockers.some((item) => item.code === 'steam-price-higher-than-other-service')) throw new Error('Steam price parity violation was not blocked')

const snapshotPath = path.join(root, 'knowledge/verifications/steam/early-access-review-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/steam/early-access-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-game-early-access-plan', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-early-access-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-early-access-review-revision.md',
  connectorId: 'steam-early-access-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-early-access-review-revision-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-early-access-rules', status: 'passed' },
    { id: 'six-question-official-qa', status: 'passed' },
    { id: 'playable-current-build-and-non-crowdfunding-boundary', status: 'passed' },
    { id: 'future-promise-price-and-third-party-boundaries', status: 'passed' },
    { id: 'v1-date-field-documentation-conflict-preserved', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'questionnaire-build-answer-eligibility-price-and-disclosure-binding', status: 'passed' },
    { id: 'eligibility-and-disclosure-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'input-output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' },
  ],
  evidence: [...evidence, { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/early-access-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
  sideEffects: [{ effect: 'none', status: 'none' }],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, answers: prepared.answers.length, expiresAt: report.expiresAt }, null, 2))

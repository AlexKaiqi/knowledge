import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareSteamStoreDescriptionReviewRevision } from '../connectors/steam-store-description-revision/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'steam-store-written-description',
    url: 'https://partner.steamgames.com/doc/store/page/description?l=english&language=english',
    assertions: ['No Formatting', 'No time based text', 'No links', 'limited to a few hundred characters'],
  },
  {
    id: 'steam-store-review-process',
    url: 'https://partner.steamgames.com/doc/store/review_process?l=english&language=english',
    assertions: ['description will need to be detailed and coherent', 'store page should only contain features and content that will be available at launch', 'Mark as ready for review'],
  },
  {
    id: 'steam-store-localization-languages',
    url: 'https://partner.steamgames.com/doc/store/localization/languages?l=english&language=english',
    assertions: ["English is Steam's fallback language and needs to have content", 'schinese', 'tchinese', 'koreana', 'latam'],
  },
]

const startedAt = new Date()
const sourceEvidence = []
for (const source of sources) {
  const response = await fetch(source.url, { method: 'GET', redirect: 'error', headers: { 'user-agent': 'knowledge-steam-description-probe/1.0' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const normalizedText = body.toString('utf8').replace(/\s+/g, ' ')
  for (const assertion of source.assertions) if (!normalizedText.includes(assertion)) throw new Error(`${source.id} semantic missing: ${assertion}`)
  sourceEvidence.push({ kind: 'artifact', ref: source.url, sha256: sha256(body) })
}

const input = {
  gameRef: 'game:clockwork-familiar',
  sourceRevisionRef: 'fixture:steam-store-copy-v1',
  localizations: [
    {
      language: 'english',
      shortDescription: 'Guide a tiny clockwork familiar through shifting rooms where every sound changes the path.',
      aboutThisGame: 'Guide a clockwork familiar through an ever-changing house. Listen for hidden mechanisms, solve compact spatial puzzles, and choose which memories the familiar carries into the next room.\n\nThe launch build contains a complete single-player journey with keyboard and controller support.',
      translationBasisRef: 'copy:owned-english-draft-v1',
    },
    {
      language: 'schinese',
      shortDescription: '引导一只发条使魔穿过不断变化的房间，每一种声音都会改变前路。',
      aboutThisGame: '引导发条使魔探索一座不断变化的房屋。聆听隐藏机关，解开紧凑的空间谜题，并决定使魔要将哪些记忆带入下一个房间。\n\n首发版本包含完整的单人旅程，并支持键盘与控制器。',
      translationBasisRef: 'translation:schinese-human-review-v1',
    },
  ],
  launchFeatureRefs: ['build:probe-demo-v1', 'design:launch-feature-ledger-v1'],
  rightsBasisRefs: ['rights:owned-game-copy-v1'],
}

const prepared = prepareSteamStoreDescriptionReviewRevision(input, { now: () => new Date('2026-08-27T04:00:00Z') })
const replay = prepareSteamStoreDescriptionReviewRevision({ ...input, localizations: [...input.localizations].reverse() }, { now: () => new Date('2026-08-28T04:00:00Z') })
if (prepared.status !== 'ready-for-human-review' || prepared.revisionHash !== replay.revisionHash) throw new Error('deterministic localized copy replay failed')
if (!prepared.manualReview.required || !prepared.manualReview.checks.every((item) => item.status === 'pending')) throw new Error('manual review boundary mismatch')
if (prepared.uploaded || prepared.published || prepared.markedReadyForReview || prepared.released || prepared.executionAuthorized) throw new Error('platform execution boundary mismatch')
const edited = structuredClone(input)
edited.localizations[0].shortDescription += ' Quietly.'
if (prepareSteamStoreDescriptionReviewRevision(edited).revisionHash === prepared.revisionHash) throw new Error('copy mutation did not invalidate revision')
const withoutEnglish = { ...input, localizations: input.localizations.filter((item) => item.language !== 'english') }
if (!prepareSteamStoreDescriptionReviewRevision(withoutEnglish).preflight.blockers.some((item) => item.code === 'english-fallback-required')) throw new Error('missing English fallback was not blocked')
const linked = structuredClone(input)
linked.localizations[0].aboutThisGame += '\nVisit example.com.'
if (!prepareSteamStoreDescriptionReviewRevision(linked).preflight.blockers.some((item) => item.code === 'description-link-not-allowed')) throw new Error('external link was not blocked')
const markedUp = structuredClone(input)
markedUp.localizations[0].shortDescription = '[b]Clockwork familiar[/b]'
if (!prepareSteamStoreDescriptionReviewRevision(markedUp).preflight.blockers.some((item) => item.code === 'short-description-must-be-plain-single-line')) throw new Error('formatted short description was not blocked')
const unknownLanguage = structuredClone(input)
unknownLanguage.localizations[1].language = 'esperanto'
if (!prepareSteamStoreDescriptionReviewRevision(unknownLanguage).preflight.blockers.some((item) => item.code === 'unsupported-store-language')) throw new Error('unknown store language was not blocked')

const schema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/steam/prepare-store-description-review-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(prepared)) throw new Error(`Steam description output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/steam/store-description-review-revision/snapshot.json')
const reportPath = path.join(repositoryRoot, 'knowledge/verifications/steam/store-description-review-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'owned-localized-text-only-store-description', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `steam-store-description-review-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/steam/prepare-store-description-review-revision.md',
  connectorId: 'steam-store-description-revision',
  probeDefinitionRef: 'repo:/probes/definitions/steam-store-description-review-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'current-official-description-rules', status: 'passed' },
    { id: 'english-fallback-and-language-codes', status: 'passed' },
    { id: 'deterministic-replay-and-mutation-binding', status: 'passed' },
    { id: 'fallback-link-markup-and-language-blockers', status: 'passed' },
    { id: 'manual-review-boundary', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-platform-write-boundary', status: 'passed' }
  ],
  evidence: [
    ...sourceEvidence,
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/steam/store-description-review-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

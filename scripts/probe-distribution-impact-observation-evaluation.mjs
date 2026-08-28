import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { evaluateDistributionImpactObservations } from '../connectors/distribution-impact-observation-evaluator/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'probes/fixtures/distribution/impact-observation-evaluation.json')
const inputSchemaPath = path.join(root, 'knowledge/schemas/distribution/evaluate-impact-observation-set-input.schema.json')
const outputSchemaPath = path.join(root, 'knowledge/schemas/distribution/evaluate-impact-observation-set-output.schema.json')
const verificationRoot = path.join(root, 'knowledge/verifications/distribution/impact-observation-evaluation')
const snapshotPath = path.join(verificationRoot, 'snapshot.json')
const reportPath = path.join(verificationRoot, 'report.json')

const sourceChecks = [
  {
    id: 'steam-utm-analytics', url: 'https://partner.steamgames.com/doc/marketing/utm_analytics',
    assertions: ['Total Visits: The total number of visits to your product page that had a UTM code attached to the URL.', 'Conversions are finalized 4 days after the visit.', 'Some users will not be tracked based on their browser configuration or cookie preferences'],
  },
  {
    id: 'apple-campaign-links', url: 'https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links',
    assertions: ['Analytics captures the impressions, product page views, downloads, usage, sales, and subscriptions tied to each campaign token.', 'minimum threshold of 5', 'only the most recent link receives credit for subsequent sales'],
  },
  {
    id: 'apple-analytics-reports', url: 'https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api',
    assertions: ['first report approximately 24-48 hours later', 'Data for a given day is considered complete two days after the reporting date'],
  },
  {
    id: 'google-play-store-performance', url: 'https://support.google.com/googleplay/android-developer/answer/9859173?hl=en',
    assertions: ['From July 2026, Google Play updated store listing performance reports to focus on user intent (clicks) rather than successful outcomes (acquisitions).', 'Not attributed', 'Store listing reports do not include visitors or acquisitions from other surfaces on Google Play'],
  },
]

const normalizeHtmlText = (value) => value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&nbsp;', ' ')
  .replace(/\s+/g, ' ')
  .trim()
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const startedAt = new Date()
const sourceEvidence = []
for (const source of sourceChecks) {
  const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`official source fetch failed for ${source.id}: HTTP_${response.status}`)
  const raw = await response.text()
  const text = normalizeHtmlText(raw)
  for (const assertion of source.assertions) if (!text.includes(assertion) && !raw.includes(assertion)) throw new Error(`official semantic assertion changed for ${source.id}: ${assertion}`)
  sourceEvidence.push({ id: source.id, url: source.url, semanticDigest: sha256(JSON.stringify(source.assertions)), assertions: source.assertions.length })
}

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const inputSchema = JSON.parse(await readFile(inputSchemaPath, 'utf8'))
const outputSchema = JSON.parse(await readFile(outputSchemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`fixture input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
const result = evaluateDistributionImpactObservations(fixture)
if (!validateOutput(result)) throw new Error(`result output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)
const reversed = evaluateDistributionImpactObservations({ ...fixture, comparisons: [...fixture.comparisons].reverse() })
if (JSON.stringify(result) !== JSON.stringify(reversed)) throw new Error('comparison ordering changes deterministic result')

const byRef = new Map(result.comparisons.map((item) => [item.comparisonRef, item]))
if (byRef.get('apple:downloads-suppressed').status !== 'unknown' || byRef.get('apple:downloads-suppressed').delta !== null) throw new Error('privacy suppression was coerced into a delta')
if (byRef.get('apple:views-not-finalized').status !== 'pending' || byRef.get('apple:views-not-finalized').delta !== null) throw new Error('not-finalized observation did not remain pending')
if (byRef.get('play:definition-drift').status !== 'definition-drift') throw new Error('native definition drift was not isolated')
if (byRef.get('steam:tracked-visits-attributed').attributionConclusion !== 'platform-attributed') throw new Error('exact platform attribution was not preserved')
if (byRef.get('steam:total-visits-temporal').attributionConclusion !== 'temporal-association' || !byRef.get('steam:total-visits-temporal').reasons.includes('causality-not-established')) throw new Error('temporal association overclaimed causality')
if (byRef.get('play:clicks-unattributed').attributionConclusion !== 'unknown') throw new Error('unattributed observation was promoted')

const noReceipt = structuredClone(fixture)
delete noReceipt.publication.receiptRef
if (evaluateDistributionImpactObservations(noReceipt).comparisons.find((item) => item.comparisonRef === 'steam:tracked-visits-attributed').attributionConclusion !== 'unknown') throw new Error('platform attribution survived a missing receipt')
const scopeMutation = structuredClone(fixture)
scopeMutation.comparisons[0].current.scopeDigest = `sha256:${'9'.repeat(64)}`
if (evaluateDistributionImpactObservations(scopeMutation).comparisons.find((item) => item.comparisonRef === 'steam:tracked-visits-attributed').status !== 'unknown') throw new Error('scope mutation remained comparable')
const crossPlatform = structuredClone(fixture)
crossPlatform.comparisons[0].current.platform = 'google-play'
let crossPlatformRejected = false
try { evaluateDistributionImpactObservations(crossPlatform) } catch (error) { crossPlatformRejected = /different platforms/.test(error.message) }
if (!crossPlatformRejected) throw new Error('cross-platform comparison was accepted')
if (!result.noCrossPlatformScore || result.causalClaimGenerated || result.platformDataRead || result.knowledgeWritten || result.actionExecuted || result.executionAuthorized) throw new Error('effect or causal boundary drifted')

const snapshot = { fixture: 'steam-apple-google-play-native-impact-observations', ...result }
await mkdir(verificationRoot, { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `distribution-impact-observation-evaluation-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/distribution/evaluate-impact-observation-set.md',
  connectorId: 'distribution-impact-observation-evaluator',
  probeDefinitionRef: 'repo:/probes/definitions/distribution-impact-observation-evaluation-local.json',
  environment: 'local', level: 'local', outcome: 'passed',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'official-native-metric-semantics', status: 'passed' },
    { id: 'public-input-schema', status: 'passed' },
    { id: 'public-output-schema', status: 'passed' },
    { id: 'same-native-definition-only', status: 'passed' },
    { id: 'suppression-is-not-zero', status: 'passed' },
    { id: 'finalization-remains-pending', status: 'passed' },
    { id: 'definition-drift-isolated', status: 'passed' },
    { id: 'scope-mutation-invalidation', status: 'passed' },
    { id: 'cross-platform-comparison-rejected', status: 'passed' },
    { id: 'receipt-bound-platform-attribution', status: 'passed' },
    { id: 'temporal-association-denies-causality', status: 'passed' },
    { id: 'unattributed-remains-unknown', status: 'passed' },
    { id: 'deterministic-ordering', status: 'passed' },
    { id: 'effect-free', status: 'passed' }
  ],
  evidence: [
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/distribution/impact-observation-evaluation/snapshot.json', sha256: sha256(await readFile(snapshotPath)) },
    ...sourceEvidence.map((item) => ({ kind: 'artifact', ref: item.url, sha256: item.semanticDigest }))
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ outcome: report.outcome, comparisons: result.summary, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2)}\n`)

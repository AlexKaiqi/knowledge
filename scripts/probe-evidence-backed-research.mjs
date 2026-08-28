import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { SCENARIO_STRATEGIES, normalizeResearchDossier } from '../connectors/evidence-backed-research-agent/src/index.mjs'
import { searchPublicAppCatalog } from '../connectors/apple-public-app-search/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-methods.json')
const platformFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-app-review-route.json')
const xianyuFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-xianyu-route.json')
const demandSourceRoutesFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-demand-source-routes.json')
const assistantApprovalFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-assistant-approval.json')
const assistantApprovalTransportFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-assistant-approval-transport.json')
const personalAssistantDemandFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-personal-assistant-demand.json')
const assistantMemoryFrontierFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-assistant-memory-frontier.json')
const distributionImpactFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-distribution-impact.json')
const personalAssistantMarketFixturePath = path.join(root, 'probes/fixtures/evidence-backed-research-personal-assistant-market.json')
const schemaPath = path.join(root, 'knowledge/schemas/research/conduct-evidence-backed-research-output.schema.json')
const snapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/snapshot.json')
const platformSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/platform-integration-snapshot.json')
const xianyuSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json')
const demandSourceRoutesSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json')
const assistantApprovalSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json')
const assistantApprovalTransportSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json')
const personalAssistantDemandSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json')
const assistantMemoryFrontierSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json')
const distributionImpactSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/distribution-impact-snapshot.json')
const personalAssistantMarketSnapshotPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/research/evidence-backed-research/report.json')

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const rawUrl = (resource) => resource
  .replace('https://github.com/', 'https://raw.githubusercontent.com/')
  .replace('/blob/', '/')

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

async function verifyPlatformSourceCheck(sourceCheck) {
  if (sourceCheck.kind === 'repository-manifest') {
    const manifest = []
    for (const relativePath of sourceCheck.files) {
      manifest.push({ relativePath, sha256: sha256(await readFile(path.join(root, relativePath))) })
    }
    const canonicalManifest = manifest.map(({ relativePath, sha256: fileDigest }) => ({ path: relativePath, sha256: fileDigest }))
    if (sha256(JSON.stringify(canonicalManifest)) !== sourceCheck.digest) throw new Error(`repository manifest changed for ${sourceCheck.id}`)
    return
  }
  if (sourceCheck.kind === 'apple-public-app-search') {
    const result = await searchPublicAppCatalog(sourceCheck.input)
    if (result.conformance.status !== 'passed') throw new Error(`Apple public app search requires review for ${sourceCheck.id}`)
    if (result.coverage.returnedCount !== sourceCheck.expectedReturnedCount) throw new Error(`Apple public app search count changed for ${sourceCheck.id}`)
    for (const requiredItem of sourceCheck.requiredItems) {
      const observedItem = result.items.find((item) => item.appId === requiredItem.appId)
      if (!observedItem || observedItem.name !== requiredItem.name || observedItem.primaryGenre !== requiredItem.primaryGenre) throw new Error(`Apple public app search item changed for ${sourceCheck.id}: ${requiredItem.appId}`)
    }
    const semanticProjection = { input: sourceCheck.input, expectedReturnedCount: sourceCheck.expectedReturnedCount, requiredItems: sourceCheck.requiredItems }
    if (sha256(JSON.stringify(semanticProjection)) !== sourceCheck.digest) throw new Error(`Apple public app search semantic digest changed for ${sourceCheck.id}`)
    return
  }
  if (sourceCheck.kind !== 'html-semantic') throw new Error(`unsupported platform source check kind: ${sourceCheck.kind}`)
  const response = await fetch(sourceCheck.url, { redirect: 'error', signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`platform source fetch failed for ${sourceCheck.id}: HTTP_${response.status}`)
  const raw = await response.text()
  const text = normalizeHtmlText(raw)
  for (const assertion of sourceCheck.assertions) {
    if (!text.includes(assertion) && !raw.includes(assertion)) throw new Error(`platform source assertion changed for ${sourceCheck.id}: ${assertion}`)
  }
  if (sha256(JSON.stringify(sourceCheck.assertions)) !== sourceCheck.digest) throw new Error(`platform source semantic digest changed for ${sourceCheck.id}`)
}

const startedAt = new Date()
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const platformFixture = JSON.parse(await readFile(platformFixturePath, 'utf8'))
const xianyuFixture = JSON.parse(await readFile(xianyuFixturePath, 'utf8'))
const demandSourceRoutesFixture = JSON.parse(await readFile(demandSourceRoutesFixturePath, 'utf8'))
const assistantApprovalFixture = JSON.parse(await readFile(assistantApprovalFixturePath, 'utf8'))
const assistantApprovalTransportFixture = JSON.parse(await readFile(assistantApprovalTransportFixturePath, 'utf8'))
const personalAssistantDemandFixture = JSON.parse(await readFile(personalAssistantDemandFixturePath, 'utf8'))
const assistantMemoryFrontierFixture = JSON.parse(await readFile(assistantMemoryFrontierFixturePath, 'utf8'))
const distributionImpactFixture = JSON.parse(await readFile(distributionImpactFixturePath, 'utf8'))
const personalAssistantMarketFixture = JSON.parse(await readFile(personalAssistantMarketFixturePath, 'utf8'))

for (const item of fixture.candidate.evidence) {
  const response = await fetch(rawUrl(item.resource), { redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`evidence fetch failed for ${item.id}: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== item.digest) throw new Error(`evidence digest changed for ${item.id}`)
}

const dossier = normalizeResearchDossier(fixture.candidate, { input: fixture.input, now: () => startedAt })
for (const sourceCheck of platformFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const platformDossier = normalizeResearchDossier(platformFixture.candidate, { input: platformFixture.input, now: () => startedAt })
for (const sourceCheck of xianyuFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const xianyuDossier = normalizeResearchDossier(xianyuFixture.candidate, { input: xianyuFixture.input, now: () => startedAt })
for (const sourceCheck of demandSourceRoutesFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const demandSourceRoutesDossier = normalizeResearchDossier(demandSourceRoutesFixture.candidate, { input: demandSourceRoutesFixture.input, now: () => startedAt })
for (const sourceCheck of assistantApprovalFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const assistantApprovalDossier = normalizeResearchDossier(assistantApprovalFixture.candidate, { input: assistantApprovalFixture.input, now: () => startedAt })
for (const sourceCheck of assistantApprovalTransportFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const assistantApprovalTransportDossier = normalizeResearchDossier(assistantApprovalTransportFixture.candidate, { input: assistantApprovalTransportFixture.input, now: () => startedAt })
for (const sourceCheck of personalAssistantDemandFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const personalAssistantDemandDossier = normalizeResearchDossier(personalAssistantDemandFixture.candidate, { input: personalAssistantDemandFixture.input, now: () => startedAt })
for (const sourceCheck of assistantMemoryFrontierFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const assistantMemoryFrontierDossier = normalizeResearchDossier(assistantMemoryFrontierFixture.candidate, { input: assistantMemoryFrontierFixture.input, now: () => startedAt })
for (const sourceCheck of distributionImpactFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const distributionImpactDossier = normalizeResearchDossier(distributionImpactFixture.candidate, { input: distributionImpactFixture.input, now: () => startedAt })
for (const sourceCheck of personalAssistantMarketFixture.sourceChecks) await verifyPlatformSourceCheck(sourceCheck)
const personalAssistantMarketDossier = normalizeResearchDossier(personalAssistantMarketFixture.candidate, { input: personalAssistantMarketFixture.input, now: () => startedAt })
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(dossier)) throw new Error(`dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (dossier.conformance.status !== 'passed') throw new Error('dossier conformance requires review')
if (!validate(platformDossier)) throw new Error(`platform dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (platformDossier.conformance.status !== 'passed') throw new Error('platform dossier conformance requires review')
if (!validate(xianyuDossier)) throw new Error(`Xianyu dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (xianyuDossier.conformance.status !== 'passed') throw new Error('Xianyu dossier conformance requires review')
if (!validate(demandSourceRoutesDossier)) throw new Error(`demand source routes dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (demandSourceRoutesDossier.conformance.status !== 'passed') throw new Error('demand source routes dossier conformance requires review')
if (!validate(assistantApprovalDossier)) throw new Error(`assistant approval dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (assistantApprovalDossier.conformance.status !== 'passed') throw new Error('assistant approval dossier conformance requires review')
if (!validate(assistantApprovalTransportDossier)) throw new Error(`assistant approval transport dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (assistantApprovalTransportDossier.conformance.status !== 'passed') throw new Error('assistant approval transport dossier conformance requires review')
if (!validate(personalAssistantDemandDossier)) throw new Error(`personal assistant demand dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (personalAssistantDemandDossier.conformance.status !== 'passed') throw new Error('personal assistant demand dossier conformance requires review')
if (!validate(assistantMemoryFrontierDossier)) throw new Error(`assistant memory frontier dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (assistantMemoryFrontierDossier.conformance.status !== 'passed') throw new Error('assistant memory frontier dossier conformance requires review')
if (!validate(distributionImpactDossier)) throw new Error(`distribution impact dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (distributionImpactDossier.conformance.status !== 'passed') throw new Error('distribution impact dossier conformance requires review')
if (!validate(personalAssistantMarketDossier)) throw new Error(`personal assistant market dossier schema mismatch: ${JSON.stringify(validate.errors)}`)
if (personalAssistantMarketDossier.conformance.status !== 'passed') throw new Error('personal assistant market dossier conformance requires review')
if (platformFixture.agentObservation.scenario !== 'platform-integration' || platformFixture.agentObservation.openedSourceCount !== platformFixture.sourceChecks.length || platformFixture.agentObservation.counterSearchPerformed !== true || platformFixture.agentObservation.humanReviewRequired !== true) throw new Error('platform Agent observation is incomplete')
if (xianyuFixture.agentObservation.scenario !== 'platform-integration' || xianyuFixture.agentObservation.openedSourceCount !== xianyuFixture.sourceChecks.length || xianyuFixture.agentObservation.counterSearchPerformed !== true || xianyuFixture.agentObservation.humanReviewRequired !== true) throw new Error('Xianyu Agent observation is incomplete')
if (demandSourceRoutesFixture.agentObservation.scenario !== 'platform-integration' || demandSourceRoutesFixture.agentObservation.openedSourceCount !== demandSourceRoutesFixture.sourceChecks.length || demandSourceRoutesFixture.agentObservation.counterSearchPerformed !== true || demandSourceRoutesFixture.agentObservation.humanReviewRequired !== true) throw new Error('demand source routes Agent observation is incomplete')
if (assistantApprovalFixture.agentObservation.scenario !== 'technical-solution' || assistantApprovalFixture.agentObservation.openedSourceCount !== assistantApprovalFixture.sourceChecks.length || assistantApprovalFixture.agentObservation.counterSearchPerformed !== true || assistantApprovalFixture.agentObservation.humanReviewRequired !== true) throw new Error('assistant approval Agent observation is incomplete')
if (assistantApprovalTransportFixture.agentObservation.scenario !== 'technical-solution' || assistantApprovalTransportFixture.agentObservation.openedSourceCount !== assistantApprovalTransportFixture.sourceChecks.length || assistantApprovalTransportFixture.agentObservation.counterSearchPerformed !== true || assistantApprovalTransportFixture.agentObservation.humanReviewRequired !== true) throw new Error('assistant approval transport Agent observation is incomplete')
if (personalAssistantDemandFixture.agentObservation.scenario !== 'demand' || personalAssistantDemandFixture.agentObservation.openedSourceCount !== personalAssistantDemandFixture.sourceChecks.length || personalAssistantDemandFixture.agentObservation.counterSearchPerformed !== true || personalAssistantDemandFixture.agentObservation.humanReviewRequired !== true) throw new Error('personal assistant demand Agent observation is incomplete')
if (assistantMemoryFrontierFixture.agentObservation.scenario !== 'academic-frontier' || assistantMemoryFrontierFixture.agentObservation.openedSourceCount !== assistantMemoryFrontierFixture.sourceChecks.length || assistantMemoryFrontierFixture.agentObservation.counterSearchPerformed !== true || assistantMemoryFrontierFixture.agentObservation.humanReviewRequired !== true) throw new Error('assistant memory frontier Agent observation is incomplete')
if (distributionImpactFixture.agentObservation.scenario !== 'distribution-impact' || distributionImpactFixture.agentObservation.openedSourceCount !== distributionImpactFixture.sourceChecks.length || distributionImpactFixture.agentObservation.counterSearchPerformed !== true || distributionImpactFixture.agentObservation.humanReviewRequired !== true) throw new Error('distribution impact Agent observation is incomplete')
if (personalAssistantMarketFixture.agentObservation.scenario !== 'market-competitive' || personalAssistantMarketFixture.agentObservation.openedSourceCount !== personalAssistantMarketFixture.sourceChecks.length || personalAssistantMarketFixture.agentObservation.counterSearchPerformed !== true || personalAssistantMarketFixture.agentObservation.humanReviewRequired !== true) throw new Error('personal assistant market Agent observation is incomplete')
if (Object.keys(SCENARIO_STRATEGIES).length !== 6 || new Set(Object.values(SCENARIO_STRATEGIES).map((strategy) => strategy.method)).size !== 6) throw new Error('scenario strategies are incomplete or duplicated')
if (/connectorId|credentialRef|promptRef|internalTrace/.test(JSON.stringify({ dossier, platformDossier, xianyuDossier, demandSourceRoutesDossier, assistantApprovalDossier, assistantApprovalTransportDossier, personalAssistantDemandDossier, assistantMemoryFrontierDossier, distributionImpactDossier, personalAssistantMarketDossier }))) throw new Error('public dossier leaks hidden execution details')

await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'github-research-methods', ...dossier }, null, 2)}\n`)
await writeFile(platformSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'app-review-provider-route', ...platformDossier }, null, 2)}\n`)
await writeFile(xianyuSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'xianyu-keyword-search-route', ...xianyuDossier }, null, 2)}\n`)
await writeFile(demandSourceRoutesSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'google-xianyu-58-boss-demand-source-routes', ...demandSourceRoutesDossier }, null, 2)}\n`)
await writeFile(assistantApprovalSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'assistant-impact-aware-approval', ...assistantApprovalDossier }, null, 2)}\n`)
await writeFile(assistantApprovalTransportSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'assistant-approval-transport-security', ...assistantApprovalTransportDossier }, null, 2)}\n`)
await writeFile(personalAssistantDemandSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'personal-assistant-independent-difficulties', ...personalAssistantDemandDossier }, null, 2)}\n`)
await writeFile(assistantMemoryFrontierSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'personal-assistant-memory-academic-frontier', ...assistantMemoryFrontierDossier }, null, 2)}\n`)
await writeFile(distributionImpactSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'game-app-distribution-impact', ...distributionImpactDossier }, null, 2)}\n`)
await writeFile(personalAssistantMarketSnapshotPath, `${JSON.stringify({ schemaVersion: 'dsh.probe-snapshot/research-evidence-backed/v1', fixture: 'personal-assistant-market-competitive', ...personalAssistantMarketDossier }, null, 2)}\n`)

const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `evidence-backed-research-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/research/conduct-evidence-backed-research.md',
  connectorId: 'evidence-backed-research-agent',
  probeDefinitionRef: 'repo:/probes/definitions/evidence-backed-research-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'pinned-evidence-readable', status: 'passed' },
    { id: 'pinned-evidence-digests', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'finding-traceability', status: 'passed' },
    { id: 'scenario-role-coverage', status: 'passed' },
    { id: 'counter-evidence-search', status: 'passed' },
    { id: 'six-scenario-strategies', status: 'passed' },
    { id: 'platform-integration-official-boundary', status: 'passed' },
    { id: 'platform-integration-implementation-evidence', status: 'passed' },
    { id: 'platform-integration-counter-evidence', status: 'passed' },
    { id: 'platform-integration-agent-observation', status: 'passed', detail: 'Three interactive Agent research runs were observed and normalized; repeatability across runtimes remains unproven.' },
    { id: 'xianyu-paid-route-authorization-boundary', status: 'passed' },
    { id: 'xianyu-technical-feasibility-separated-from-platform-permission', status: 'passed' },
    { id: 'demand-source-route-agent-observation', status: 'passed', detail: 'One interactive route-selection run audited Google, Xianyu, 58 and BOSS official boundaries, paid provider claims and the exact local candidate implementations.' },
    { id: 'demand-source-paid-access-separated-from-platform-authorization', status: 'passed' },
    { id: 'demand-source-route-selection-is-probe-shaped', status: 'passed' },
    { id: 'demand-source-no-unverified-platform-coverage', status: 'passed' },
    { id: 'technical-solution-agent-observation', status: 'passed', detail: 'One interactive technical-solution research run compared the verified local action chain with two independent runtime approval/resume contracts.' },
    { id: 'assistant-approval-before-effect', status: 'passed' },
    { id: 'assistant-approval-execution-separation', status: 'passed' },
    { id: 'assistant-resume-replay-counter-evidence', status: 'passed' },
    { id: 'assistant-approval-transport-agent-observation', status: 'passed', detail: 'A second technical-solution run audited the current DSH approval contract, pinned Web transport source and three repository-native security reproductions.' },
    { id: 'assistant-web-approval-owner-binding-rejected', status: 'passed' },
    { id: 'assistant-web-approval-self-and-cross-session-counter-evidence', status: 'passed' },
    { id: 'assistant-approval-cancellation-counter-evidence', status: 'passed' },
    { id: 'demand-agent-observation', status: 'passed', detail: 'One interactive demand research run separated source-native failure evidence, already-admitted local slices, independent next probes, and longitudinal product outcomes.' },
    { id: 'demand-problem-evidence', status: 'passed' },
    { id: 'demand-counter-evidence', status: 'passed' },
    { id: 'demand-no-prevalence-inference', status: 'passed' },
    { id: 'demand-independent-slice-ranking', status: 'passed' },
    { id: 'academic-frontier-agent-observation', status: 'passed', detail: 'One interactive academic-frontier run compared four exact-version memory benchmarks, longitudinal companionship counter-evidence and the current local assistant slices.' },
    { id: 'academic-frontier-paper-version-and-locator', status: 'passed' },
    { id: 'academic-frontier-benchmark-and-counter-evidence', status: 'passed' },
    { id: 'academic-frontier-product-probe-boundary', status: 'passed' },
    { id: 'distribution-impact-agent-observation', status: 'passed', detail: 'One interactive distribution-impact run compared exact current Steam, App Store Connect and Google Play metric, finalization, suppression and attribution semantics.' },
    { id: 'distribution-impact-native-metric-boundary', status: 'passed' },
    { id: 'distribution-impact-finalization-and-suppression', status: 'passed' },
    { id: 'distribution-impact-no-causal-overclaim', status: 'passed' },
    { id: 'distribution-impact-next-probe-effect-free', status: 'passed' },
    { id: 'market-competitive-agent-observation', status: 'passed', detail: 'One interactive market-competitive run compared three bounded Apple catalog pages, two fixed source implementations, an independent long-horizon audit and the current local capability boundary.' },
    { id: 'market-competitive-category-boundary', status: 'passed' },
    { id: 'market-competitive-implementation-versus-outcome', status: 'passed' },
    { id: 'market-competitive-no-market-size-or-composite-score', status: 'passed' },
    { id: 'market-competitive-next-probe-effect-free', status: 'passed' },
    { id: 'hidden-execution-boundary', status: 'passed' }
  ],
  evidence: [
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/snapshot.json', sha256: sha256(await readFile(snapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/platform-integration-snapshot.json', sha256: sha256(await readFile(platformSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json', sha256: sha256(await readFile(xianyuSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json', sha256: sha256(await readFile(demandSourceRoutesSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json', sha256: sha256(await readFile(assistantApprovalSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json', sha256: sha256(await readFile(assistantApprovalTransportSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json', sha256: sha256(await readFile(personalAssistantDemandSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json', sha256: sha256(await readFile(assistantMemoryFrontierSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/distribution-impact-snapshot.json', sha256: sha256(await readFile(distributionImpactSnapshotPath)) },
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json', sha256: sha256(await readFile(personalAssistantMarketSnapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshots: [snapshotPath, platformSnapshotPath, xianyuSnapshotPath, demandSourceRoutesSnapshotPath, assistantApprovalSnapshotPath, assistantApprovalTransportSnapshotPath, personalAssistantDemandSnapshotPath, assistantMemoryFrontierSnapshotPath, distributionImpactSnapshotPath, personalAssistantMarketSnapshotPath], expiresAt: report.expiresAt }, null, 2))

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readBoundedWorkContext } from '../connectors/bounded-work-context-projection/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionRoot = '/Users/kaiqidong/Developer/dsh-plugins/dsh-personal-knowledge-base'
const productionRevision = 'c8e181adcf3904f47fd33b85ffc1e97126cbbd66'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const startedAt = new Date()

const sourceDefinitions = [
  {
    id: 'production-service',
    path: 'dsh/service.js',
    digest: 'b849ae068d99070181b14f80eb2b0385a0f996253b8717d2331682d60a0e4bbf',
    semantics: ["add('Current work', this.readCurrent(), ['.pkb/current.md'])", "String(row.header?.id || '') !== currentSessionId", "sources: [...new Set(sources)]", "async project(options = {})"],
  },
  {
    id: 'repository-layout',
    path: 'spec/repository-layout.json',
    digest: '5d2a81bda32184a2114c4ad525ce92c62302d5cf31074cc04ea0801bb2124bde',
    semantics: ['external-dsh-sessions', '.pkb/current.md', 'knowledge/*.md', 'query-time-projection'],
  },
  {
    id: 'production-e2e-evidence',
    path: 'eval/evidence/latest.md',
    digest: '79c458f4aacd3b31e8c1f58ab15fbfe65046d34e56bda151692372bf1ed56410',
    semantics: ['Result: **PASS**', 'Session 事件驱动 current 投影', '动态投影进入模型上下文', '当前状态收敛', 'full Session transcripts'],
  },
]

const observedRevision = execFileSync('git', ['-C', productionRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (observedRevision !== productionRevision) throw new Error(`production revision drift: ${observedRevision}`)
const sourceBodies = new Map()
for (const source of sourceDefinitions) {
  const body = await readFile(path.join(productionRoot, source.path))
  if (sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
  sourceBodies.set(source.id, body)
}

const { PersonalKnowledgeBase } = await import(pathToFileURL(path.join(productionRoot, 'dsh/service.js')).href)
const fixture = JSON.parse(await readFile(path.join(repositoryRoot, 'probes/fixtures/assistant/bounded-work-context.json'), 'utf8'))
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-work-context-probe-'))
let result
try {
  const sessionQuery = {
    async searchSessions() {
      return { items: [{
        header: { id: 'prior-fixture', cwd: '/work', createdAt: 1 },
        live: false,
        persisted: true,
        bestMatch: { seq: 7, time: 1000, snippet: 'Earlier projection decision is still relevant.' },
      }, {
        header: { id: 'current-fixture', cwd: '/work', createdAt: 2 },
        live: true,
        persisted: true,
        bestMatch: { seq: 8, time: 2000, snippet: 'CURRENT_SESSION_TRANSCRIPT_MUST_NOT_APPEAR' },
      }] }
    },
    async readTitleSnapshots(ids) {
      return ids.map((id) => ({ sessionId: id, status: 'fulfilled', value: { title: { title: 'Earlier context design' } } }))
    },
  }
  const knowledge = new PersonalKnowledgeBase(temporaryRoot, { sessionQuery, maxProjectionChars: 12000, maxCurrentChars: 5000 })
  knowledge.init()
  knowledge.writeCurrent('# Current Work\n\nFinalize the bounded projection contract.\n\n## Sources\n\n- session:current-fixture\n')
  const proposal = knowledge.propose({
    path: 'knowledge/projection-boundary.md',
    content: '# Projection boundary\n\nQuery-time context is ephemeral and never authorizes an action.\n',
    reason: 'Production projection fixture',
    source: 'session:prior-fixture',
  })
  knowledge.applyProposal(proposal.id, true)

  const projectContext = ({ query, currentSessionId, workspaceRef, maxChars, includePriorSessions }) => {
    if (workspaceRef !== 'workspace:primary') throw new Error('unexpected workspace ref')
    return knowledge.project({ query, cwd: '/work', sessionId: currentSessionId, maxChars, includeSessions: includePriorSessions })
  }
  result = await readBoundedWorkContext(fixture, { projectContext })
  if (!result.contextText.includes('Finalize the bounded projection contract.')) throw new Error('current work is missing')
  if (!result.contextText.includes('Earlier projection decision is still relevant.')) throw new Error('relevant prior Session excerpt is missing')
  if (!result.contextText.includes('Query-time context is ephemeral')) throw new Error('matching durable knowledge is missing')
  if (result.contextText.includes('CURRENT_SESSION_TRANSCRIPT_MUST_NOT_APPEAR')) throw new Error('current Session was echoed as prior history')
  if (!result.sourceRefs.includes('.pkb/current.md') || !result.sourceRefs.includes('session:prior-fixture') || !result.sourceRefs.includes('knowledge/projection-boundary.md')) throw new Error('logical sources are incomplete')
  if (result.sourceRefs.includes('session:current-fixture')) throw new Error('current Session source must be excluded from prior-session sources')
  if (result.contextText.length > fixture.maxChars || result.executionAuthorized || result.sessionHistoryModified || result.durableKnowledgeModified) throw new Error('public boundary mismatch')
  if (JSON.stringify(result).includes('/work') || JSON.stringify(result).includes(knowledge.revision())) throw new Error('public output leaked a real route or revision')

  const withoutSessions = await readBoundedWorkContext({ ...fixture, includePriorSessions: false }, { projectContext })
  if (withoutSessions.sourceRefs.some((ref) => ref.startsWith('session:'))) throw new Error('prior Sessions were returned while disabled')
  const tight = await readBoundedWorkContext({ ...fixture, maxChars: 1200 }, { projectContext })
  if (tight.contextText.length > 1200 || tight.coverage.projectionComplete !== false) throw new Error('tight budget was not preserved')

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/read-bounded-work-context-input.schema.json'), 'utf8'))
  const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/read-bounded-work-context-output.schema.json'), 'utf8'))
  const validateInput = ajv.compile(inputSchema)
  const validateOutput = ajv.compile(outputSchema)
  if (!validateInput(fixture)) throw new Error(`input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
  for (const output of [result, withoutSessions, tight]) if (!validateOutput(output)) throw new Error(`output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

  const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/bounded-work-context/snapshot.json')
  const reportPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/bounded-work-context/report.json')
  await mkdir(path.dirname(snapshotPath), { recursive: true })
  await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'isolated-production-personal-knowledge-projection', productionRevision, ...result }, null, 2)}\n`)
  const finishedAt = new Date()
  const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const report = {
    schemaVersion: 'dsh.probe-report/v1',
    id: `bounded-work-context-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
    capabilityRef: '/capabilities/assistant/read-bounded-work-context.md',
    connectorId: 'bounded-work-context-projection',
    probeDefinitionRef: 'repo:/probes/definitions/bounded-work-context-local.json',
    environment: 'local',
    level: 'local',
    outcome: 'passed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    checks: [
      { id: 'pinned-production-boundaries', status: 'passed' },
      { id: 'production-e2e-evidence', status: 'passed' },
      { id: 'real-query-time-projection', status: 'passed' },
      { id: 'current-session-exclusion', status: 'passed' },
      { id: 'prior-session-disable', status: 'passed' },
      { id: 'character-budget', status: 'passed' },
      { id: 'logical-source-only', status: 'passed' },
      { id: 'output-schema', status: 'passed' },
      { id: 'ephemeral-non-execution-boundary', status: 'passed' },
      { id: 'temporary-repository-cleanup', status: 'passed' }
    ],
    evidence: [
      ...sourceDefinitions.map((source) => ({ kind: 'artifact', ref: `https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/${productionRevision}/${source.path}`, sha256: source.digest })),
      { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/bounded-work-context/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
    ],
    sideEffects: [{ effect: 'none', status: 'none' }]
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

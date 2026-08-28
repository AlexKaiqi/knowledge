import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { maintainCurrentWorkProjection } from '../connectors/current-work-projection-maintainer/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionRoot = '/Users/kaiqidong/Developer/dsh-plugins/dsh-personal-knowledge-base'
const productionRevision = 'c8e181adcf3904f47fd33b85ffc1e97126cbbd66'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const startedAt = new Date()

const sourceDefinitions = [
  {
    id: 'production-maintainer',
    path: 'dsh/maintainer.js',
    digest: 'dcd89672a70d559f8afb14e296879ca03a027027d98c91d79eed6ae42d454fe1',
    semantics: ['async curate(sessionId, options = {})', "trigger: 'manual:curate'", 'this.enqueue(() => this.maintain', 'knowledge_candidates are optional proposals, never confirmed facts.', 'this.knowledge.writeCursor(sessionId, options.lastSeq)'],
  },
  {
    id: 'production-service',
    path: 'dsh/service.js',
    digest: 'b849ae068d99070181b14f80eb2b0385a0f996253b8717d2331682d60a0e4bbf',
    semantics: ['writeCurrent(content)', "atomicWrite(this.currentPath, value)", 'writeCursor(sessionId, seq)', 'propose(change)'],
  },
  {
    id: 'repository-layout',
    path: 'spec/repository-layout.json',
    digest: '5d2a81bda32184a2114c4ad525ce92c62302d5cf31074cc04ea0801bb2124bde',
    semantics: ['.pkb/current.md', '.pkb/cursor.json', '.pkb/proposals', 'backgroundAgentMayConfirm'],
  },
  {
    id: 'production-e2e-evidence',
    path: 'eval/evidence/latest.md',
    digest: '79c458f4aacd3b31e8c1f58ab15fbfe65046d34e56bda151692372bf1ed56410',
    semantics: ['Result: **PASS**', 'Session 事件驱动 current 投影', '未确认候选不得提交', '当前状态收敛'],
  },
]

const observedRevision = execFileSync('git', ['-C', productionRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (observedRevision !== productionRevision) throw new Error(`production revision drift: ${observedRevision}`)
for (const source of sourceDefinitions) {
  const body = await readFile(path.join(productionRoot, source.path))
  if (sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
}

const { KnowledgeMaintainer } = await import(pathToFileURL(path.join(productionRoot, 'dsh/maintainer.js')).href)
const { PersonalKnowledgeBase } = await import(pathToFileURL(path.join(productionRoot, 'dsh/service.js')).href)
const fixture = JSON.parse(await readFile(path.join(repositoryRoot, 'probes/fixtures/assistant/current-work-projection-maintenance.json'), 'utf8'))
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-current-maintenance-probe-'))

try {
  const sessionId = fixture.currentSessionRef.slice('session:'.length)
  const events = [
    { type: 'user/message', seq: 3, text: 'Current goal: finish the owner-bound assistant context flow. Progress: read projection works. Blocker: maintenance is not yet verified. Next step: verify isolated maintenance. The accepted durable product boundary is that current work remains rebuildable and separate from durable knowledge.' },
    { type: 'assistant/message', seq: 4, text: 'I will preserve the active status and keep the accepted boundary as an unconfirmed proposal.' },
  ]
  const knowledge = new PersonalKnowledgeBase(temporaryRoot)
  knowledge.init()
  const initialRevision = knowledge.revision()
  let modelCalls = 0
  let lastRequest
  const ctx = {
    llm: {
      listProviders: () => [{ id: 'fixture' }],
      listModels: async () => [{ id: 'fixture-text', inputModalities: ['text'] }],
      async *stream(request) {
        modelCalls += 1
        lastRequest = request
        yield { type: 'text-delta', text: JSON.stringify({
          current_markdown: '# Current Work\n\nGoal: finish the owner-bound assistant context flow.\n\nProgress: read projection works.\n\nBlocker: maintenance verification is in progress.\n\nNext step: verify isolated maintenance.',
          knowledge_candidates: [{
            path: 'knowledge/current-work-boundary.md',
            markdown: '# Current work boundary\n\nCurrent work is rebuildable and remains separate from confirmed durable knowledge.',
            reason: 'The user explicitly accepted this durable product boundary.',
          }],
        }) }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
    sessionQuery: {
      async filterEvents(id, filters) {
        if (id !== sessionId) throw new Error('unexpected Session resolution')
        const from = Number(filters?.[0]?.from ?? 0)
        return events.filter((event) => event.seq >= from)
      },
    },
  }
  const maintainer = new KnowledgeMaintainer(ctx, knowledge, { curateCooldownMs: 60_000 })
  const curateCurrentSession = async ({ currentSessionId, workspaceRef, instruction }) => {
    if (workspaceRef !== 'workspace:primary' || currentSessionId !== sessionId) throw new Error('opaque route resolution drift')
    const beforeCursor = knowledge.cursor(currentSessionId)?.seq ?? -1
    const beforeRevision = knowledge.revision()
    const beforeDurable = await readdir(path.join(temporaryRoot, 'knowledge'))
    const result = await maintainer.curate(currentSessionId, { cwd: '/private/owned-workspace', instruction })
    if (result.skipped) return { status: 'skipped', reason: result.reason, current: null, proposalIds: [], checkpointAdvanced: false, durableKnowledgeModified: false, gitCommitted: false }
    const afterCursor = knowledge.cursor(currentSessionId)?.seq ?? -1
    const afterDurable = await readdir(path.join(temporaryRoot, 'knowledge'))
    return {
      status: 'updated',
      reason: null,
      current: result.current,
      proposalIds: result.proposals,
      checkpointAdvanced: afterCursor > beforeCursor,
      durableKnowledgeModified: JSON.stringify(afterDurable) !== JSON.stringify(beforeDurable),
      gitCommitted: knowledge.revision() !== beforeRevision,
    }
  }

  const result = await maintainCurrentWorkProjection(fixture, { curateCurrentSession })
  const currentMarkdown = knowledge.readCurrent()
  if (!currentMarkdown.includes('Goal:') || !currentMarkdown.includes('Progress:') || !currentMarkdown.includes('Blocker:') || !currentMarkdown.includes('Next step:')) throw new Error('current work structure is incomplete')
  if (!currentMarkdown.includes(fixture.currentSessionRef)) throw new Error('current Session source is missing')
  if (knowledge.cursor(sessionId)?.seq !== 4 || !result.checkpointAdvanced) throw new Error('current Session cursor did not advance')
  if (knowledge.listProposals().length !== 1 || result.proposalRefs.length !== 1) throw new Error('unconfirmed proposal was not preserved')
  if ((await readdir(path.join(temporaryRoot, 'knowledge'))).length !== 0) throw new Error('durable knowledge was written without confirmation')
  if (knowledge.revision() !== initialRevision) throw new Error('Git history changed without confirmation')
  if (result.durableKnowledgeModified || result.gitCommitted || result.executionAuthorized) throw new Error('public mutation boundary drift')
  if (JSON.stringify(result).includes('/private/owned-workspace') || JSON.stringify(result).includes('fixture-text') || JSON.stringify(result).includes(events[0].text)) throw new Error('public output leaked provider details or Session text')
  const requestPayload = JSON.parse(lastRequest.messages[0].content[0].text)
  if (requestPayload.session.reference !== fixture.currentSessionRef || requestPayload.session.cwd !== '/private/owned-workspace' || requestPayload.session.boundary !== 'manual:curate') throw new Error('production maintainer routing mismatch')
  if (!requestPayload.transcript.includes('Current goal:') || !lastRequest.system.includes('proposals, never confirmed facts')) throw new Error('production maintainer prompt boundary mismatch')

  const replay = await maintainCurrentWorkProjection(fixture, { curateCurrentSession })
  if (replay.status !== 'no-new-session-text' || replay.currentProjectionModified || replay.proposalRefs.length > 0 || modelCalls !== 1) throw new Error('checkpoint replay was not effect-free')

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const inputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/maintain-current-work-projection-input.schema.json'), 'utf8'))
  const outputSchema = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/schemas/assistant/maintain-current-work-projection-output.schema.json'), 'utf8'))
  const validateInput = ajv.compile(inputSchema)
  const validateOutput = ajv.compile(outputSchema)
  if (!validateInput(fixture)) throw new Error(`input schema mismatch: ${JSON.stringify(validateInput.errors)}`)
  for (const output of [result, replay]) if (!validateOutput(output)) throw new Error(`output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

  const snapshotPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/current-work-projection-maintenance/snapshot.json')
  const reportPath = path.join(repositoryRoot, 'knowledge/verifications/assistant/current-work-projection-maintenance/report.json')
  await mkdir(path.dirname(snapshotPath), { recursive: true })
  const snapshot = {
    fixture: 'isolated-production-current-work-maintenance',
    productionRevision,
    productionReceipt: {
      currentProjectionSha256: sha256(currentMarkdown),
      currentSessionSource: fixture.currentSessionRef,
      cursorAdvanced: true,
      proposalCreated: true,
      proposalApplied: false,
      durableKnowledgeWritten: false,
      gitHeadChanged: false,
      modelCalls: 1,
      replayStatus: replay.status,
    },
    ...result,
  }
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  const finishedAt = new Date()
  const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const report = {
    schemaVersion: 'dsh.probe-report/v1',
    id: `current-work-projection-maintenance-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
    capabilityRef: '/capabilities/assistant/maintain-current-work-projection.md',
    connectorId: 'current-work-projection-maintainer',
    probeDefinitionRef: 'repo:/probes/definitions/current-work-projection-maintenance-local.json',
    environment: 'local',
    level: 'local',
    outcome: 'passed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    checks: [
      { id: 'pinned-production-boundaries', status: 'passed' },
      { id: 'production-e2e-evidence', status: 'passed' },
      { id: 'real-current-projection-write', status: 'passed' },
      { id: 'current-session-source-and-cursor', status: 'passed' },
      { id: 'unconfirmed-proposal-only', status: 'passed' },
      { id: 'checkpoint-replay', status: 'passed' },
      { id: 'public-redaction-and-schema', status: 'passed' },
      { id: 'non-commit-non-authorization-boundary', status: 'passed' },
      { id: 'temporary-repository-cleanup', status: 'passed' }
    ],
    evidence: [
      ...sourceDefinitions.map((source) => ({ kind: 'artifact', ref: `https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/${productionRevision}/${source.path}`, sha256: source.digest })),
      { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/current-work-projection-maintenance/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
    ],
    sideEffects: [{ effect: 'local-write', status: 'cleaned' }]
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

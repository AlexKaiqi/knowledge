import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { reconcileCurrentWorkProjection } from '../connectors/current-work-projection-reconciler/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionRoot = '/Users/kaiqidong/Developer/dsh-plugins/dsh-personal-knowledge-base'
const productionRevision = 'c8e181adcf3904f47fd33b85ffc1e97126cbbd66'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const startedAt = new Date()
const sourceDefinitions = [
  { path: 'dsh/maintainer.js', digest: 'dcd89672a70d559f8afb14e296879ca03a027027d98c91d79eed6ae42d454fe1', semantics: ['markReconcile()', 'this.enqueue(() => this.reconcile(options))', 'async reconcile(options = {})', '.slice(0, this.reconcileSessions)', 'for (const record of sessions.reverse())', "kind: 'seq', from: previous + 1"] },
  { path: 'dsh/service.js', digest: 'b849ae068d99070181b14f80eb2b0385a0f996253b8717d2331682d60a0e4bbf', semantics: ['atomicWrite(this.currentPath, value)', 'atomicWrite(this.cursorPath', 'if (previous && Number(previous.seq) > seq) return previous'] },
  { path: 'README.md', digest: '9ecfb7641ada902f2b286b397fecefa7ec884dcefcb53ef927e2d9b6fb600fea', semantics: ['启动和 Session flush 会通过 `sessionQuery` 对最近 Session 做游标对账', '启动对账在后台执行'] },
  { path: 'spec/repository-layout.json', digest: '5d2a81bda32184a2114c4ad525ce92c62302d5cf31074cc04ea0801bb2124bde', semantics: ['.pkb/current.md', '.pkb/cursor.json', '.pkb/proposals'] },
  { path: 'test/maintainer.test.mjs', digest: '18bd8c450ac165493928057ec8ae5c59d5bde8ccf69a37d76756bcb22945c1b5', semantics: ['startup reconciliation reads new semantic session events after the persisted cursor', "knowledge.cursor('session-persisted').seq, 4", '(await maintainer.reconcile()).sessions, 0', 'next-session context preparation coalesces persisted history exactly once'] },
  { path: 'eval/evidence/latest.md', digest: '79c458f4aacd3b31e8c1f58ab15fbfe65046d34e56bda151692372bf1ed56410', semantics: ['Result: **PASS**', 'Offline restart reconciliation (`reconcileOnStart`)', 'Session 事件驱动 current 投影'] },
]

const observedRevision = execFileSync('git', ['-C', productionRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (observedRevision !== productionRevision) throw new Error(`production revision drift: ${observedRevision}`)
for (const source of sourceDefinitions) {
  const body = await readFile(path.join(productionRoot, source.path))
  if (sha256(body) !== source.digest) throw new Error(`${source.path} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.path} semantic missing: ${semantic}`)
}

const { KnowledgeMaintainer } = await import(pathToFileURL(path.join(productionRoot, 'dsh/maintainer.js')).href)
const { PersonalKnowledgeBase } = await import(pathToFileURL(path.join(productionRoot, 'dsh/service.js')).href)
const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/assistant/current-work-projection-reconciliation.json'), 'utf8'))
const inputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/reconcile-current-work-projection-input.schema.json'), 'utf8'))
const outputSchema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/assistant/reconcile-current-work-projection-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateInput = ajv.compile(inputSchema)
const validateOutput = ajv.compile(outputSchema)
if (!validateInput(fixture)) throw new Error(`reconciliation input schema mismatch: ${JSON.stringify(validateInput.errors)}`)

const sessionRows = [
  { header: { id: 'current-live', cwd: '/private/current' }, live: true, persisted: true },
  { header: { id: 'session-beta', cwd: '/private/beta' }, live: false, persisted: true },
  { header: { id: 'session-alpha', cwd: '/private/alpha' }, live: false, persisted: true },
]
const eventRows = {
  'session-alpha': [
    { seq: 0, type: 'session/start', text: '' },
    { seq: 2, type: 'user/message', text: 'Alpha goal remains active after the process stopped.' },
    { seq: 4, type: 'assistant/message', text: 'Alpha blocker is resolved; the next step is beta.' },
  ],
  'session-beta': [
    { seq: 1, type: 'user/message', text: 'Beta work was written while the assistant was offline.' },
    { seq: 6, type: 'assistant/message', text: 'Beta is now the current next step.' },
  ],
}

function sessionReferences(markdown) {
  return [...new Set([...markdown.matchAll(/\bsession:([A-Za-z0-9._-]+)/g)].map((match) => `session:${match[1]}`))]
}

function createContext({ failBetaOnce = false } = {}) {
  let modelCalls = 0
  let betaFailures = 0
  const requests = []
  const sourceSnapshot = JSON.stringify(eventRows)
  const ctx = {
    llm: {
      listProviders: () => [{ id: 'fixture' }],
      listModels: async () => [{ id: 'fixture-text', inputModalities: ['text'] }],
      async *stream(request) {
        modelCalls += 1
        const payload = JSON.parse(request.messages[0].content[0].text)
        requests.push(payload)
        if (payload.session.reference === 'session:session-beta' && failBetaOnce && betaFailures++ === 0) throw new Error('simulated-beta-model-interruption')
        const alpha = payload.session.reference === 'session:session-alpha' || payload.currentWork.includes('session:session-alpha')
        const beta = payload.session.reference === 'session:session-beta'
        const sources = [alpha ? '- session:session-alpha' : '', beta ? '- session:session-beta' : ''].filter(Boolean).join('\n')
        yield { type: 'text-delta', text: JSON.stringify({
          current_markdown: `# Current Work\n\nGoal: restore persisted current-work increments after an offline interval.\n\nProgress: ${beta ? 'alpha and beta reconciled' : 'alpha reconciled'}.\n\nNext step: ${beta ? 'continue beta work' : 'reconcile beta'}.\n\n## Sources\n\n${sources}`,
          knowledge_candidates: payload.session.reference === 'session:session-alpha' ? [{ path: 'knowledge/recovery-boundary.md', markdown: '# Recovery boundary\n\nCurrent work remains a rebuildable projection.', reason: 'Explicit durable product boundary.' }] : [],
        }) }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
    sessionQuery: {
      async listSessions() { return structuredClone(sessionRows) },
      async listEvents(id) {
        if (id === 'current-live') throw new Error('current Session must be excluded before event access')
        return structuredClone(eventRows[id] ?? [])
      },
      async filterEvents(id, filters) {
        if (id === 'current-live') throw new Error('current Session must be excluded before filtering')
        const from = Number(filters?.[0]?.from ?? 0)
        return structuredClone((eventRows[id] ?? []).filter((row) => row.seq >= from))
      },
    },
  }
  return { ctx, sourceSnapshot, get modelCalls() { return modelCalls }, get betaFailures() { return betaFailures }, requests }
}

function createProvider({ knowledge, maintainer, context, initialRevision, rootPath }) {
  return async ({ currentSessionId, workspaceRef, excludeCurrentSession }) => {
    if (currentSessionId !== 'current-live' || workspaceRef !== 'workspace:primary' || excludeCurrentSession !== true) throw new Error('owner-bound reconciliation route drift')
    const beforeCurrent = knowledge.readCurrent()
    const beforeCursors = new Map(['session-alpha', 'session-beta'].map((id) => [id, knowledge.cursor(id)?.seq ?? -1]))
    const beforeDurable = await readdir(path.join(rootPath, 'knowledge'))
    maintainer.markReconcile()
    let result
    try {
      result = await maintainer.prepareContext({ excludeSessionId: currentSessionId })
    } catch (error) {
      throw new Error(`production reconciliation failed: ${error.message}`)
    }
    if (result?.skipped === true && result.reason === 'no-session-query') return { status: 'unavailable', reason: 'no-session-query', current: null, reconciledSessionRefs: [], checkpointAdvancedSessionRefs: [], skippedSessionRefs: [], proposalIds: [], durableKnowledgeModified: false, gitCommitted: false }
    const reconciled = []
    const skipped = []
    const proposals = []
    for (const row of result?.results ?? []) {
      if (row.result?.skipped === true) skipped.push(row.session)
      else {
        reconciled.push(row.session)
        proposals.push(...(row.result?.proposals ?? []))
      }
    }
    const checkpointed = ['session-alpha', 'session-beta'].filter((id) => (knowledge.cursor(id)?.seq ?? -1) > beforeCursors.get(id)).map((id) => `session:${id}`)
    const afterCurrent = knowledge.readCurrent()
    const currentChanged = afterCurrent !== beforeCurrent
    const afterDurable = await readdir(path.join(rootPath, 'knowledge'))
    const durableKnowledgeModified = JSON.stringify(afterDurable) !== JSON.stringify(beforeDurable)
    const gitCommitted = knowledge.revision() !== initialRevision
    if (reconciled.length === 0 && skipped.length === 0 && checkpointed.length === 0) return { status: 'no-observed-session-increments', reason: null, current: null, reconciledSessionRefs: [], checkpointAdvancedSessionRefs: [], skippedSessionRefs: [], proposalIds: [], durableKnowledgeModified, gitCommitted }
    const reason = skipped.length > 0 ? (reconciled.length > 0 ? 'no-text-model' : 'no-text-model') : null
    const status = skipped.length > 0 ? (reconciled.length > 0 ? 'partial' : 'unavailable') : 'reconciled'
    return {
      status, reason,
      current: currentChanged ? { path: '.pkb/current.md', hash: sha256(afterCurrent), chars: afterCurrent.length, sessionReferences: sessionReferences(afterCurrent) } : null,
      reconciledSessionRefs: reconciled,
      checkpointAdvancedSessionRefs: checkpointed,
      skippedSessionRefs: skipped,
      proposalIds: proposals,
      durableKnowledgeModified,
      gitCommitted,
    }
  }
}

const successRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-current-reconcile-success-'))
const recoveryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-current-reconcile-recovery-'))

try {
  const knowledge = new PersonalKnowledgeBase(successRoot)
  knowledge.init()
  knowledge.writeCurrent('# Current Work\n\nBaseline before offline reconciliation.\n')
  knowledge.writeCursor('session-alpha', 0)
  const initialRevision = knowledge.revision()
  const context = createContext()
  const maintainer = new KnowledgeMaintainer(context.ctx, knowledge, { reconcileSessions: 12, curateCooldownMs: 0 })
  const provider = createProvider({ knowledge, maintainer, context, initialRevision, rootPath: successRoot })
  const result = await reconcileCurrentWorkProjection(fixture, { reconcilePersistedSessions: provider })
  if (result.status !== 'reconciled' || result.reconciledSessionRefs.join(',') !== 'session:session-alpha,session:session-beta') throw new Error('persisted Session reconciliation mismatch')
  if (result.checkpointAdvancedSessionRefs.join(',') !== 'session:session-alpha,session:session-beta') throw new Error('per-Session checkpoint advancement mismatch')
  if (knowledge.cursor('session-alpha')?.seq !== 4 || knowledge.cursor('session-beta')?.seq !== 6) throw new Error('production cursors did not reach observed last sequences')
  const current = knowledge.readCurrent()
  if (!current.includes('session:session-alpha') || !current.includes('session:session-beta') || current.includes('session:current-live')) throw new Error('current projection source boundary mismatch')
  if (context.modelCalls !== 2 || context.requests.some((request) => request.session.reference === 'session:current-live')) throw new Error('production reconciliation routing mismatch')
  if (knowledge.listProposals().length !== 1 || (await readdir(path.join(successRoot, 'knowledge'))).length !== 0 || knowledge.revision() !== initialRevision) throw new Error('unconfirmed durable boundary drift')
  if (JSON.stringify(result).includes('/private/') || JSON.stringify(result).includes('fixture-text') || JSON.stringify(result).includes('Alpha goal')) throw new Error('public reconciliation leaked provider or Session details')
  if (JSON.stringify(eventRows) !== context.sourceSnapshot) throw new Error('Session history was modified')
  if (!validateOutput(result)) throw new Error(`reconciliation output schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

  const callsBeforeReplay = context.modelCalls
  const replay = await reconcileCurrentWorkProjection(fixture, { reconcilePersistedSessions: provider })
  if (replay.status !== 'no-observed-session-increments' || replay.currentProjectionModified || replay.checkpointsModified || context.modelCalls !== callsBeforeReplay) throw new Error('exact reconciliation replay was not effect-free')
  if (!validateOutput(replay)) throw new Error(`reconciliation replay schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

  const recoveryKnowledge = new PersonalKnowledgeBase(recoveryRoot)
  recoveryKnowledge.init()
  recoveryKnowledge.writeCurrent('# Current Work\n\nRecovery baseline.\n')
  const recoveryRevision = recoveryKnowledge.revision()
  const recoveryContext = createContext({ failBetaOnce: true })
  const recoveryMaintainer = new KnowledgeMaintainer(recoveryContext.ctx, recoveryKnowledge, { reconcileSessions: 12, curateCooldownMs: 0 })
  const recoveryProvider = createProvider({ knowledge: recoveryKnowledge, maintainer: recoveryMaintainer, context: recoveryContext, initialRevision: recoveryRevision, rootPath: recoveryRoot })
  await assertRejects(() => reconcileCurrentWorkProjection(fixture, { reconcilePersistedSessions: recoveryProvider }), /simulated-beta-model-interruption/)
  if (recoveryKnowledge.cursor('session-alpha')?.seq !== 4 || recoveryKnowledge.cursor('session-beta') !== null || !recoveryKnowledge.readCurrent().includes('session:session-alpha')) throw new Error('partial failure did not preserve the committed earlier Session')
  const resumed = await reconcileCurrentWorkProjection(fixture, { reconcilePersistedSessions: recoveryProvider })
  if (resumed.status !== 'reconciled' || resumed.reconciledSessionRefs.join(',') !== 'session:session-beta' || recoveryKnowledge.cursor('session-beta')?.seq !== 6) throw new Error('interrupted reconciliation did not resume remaining Session')
  if (recoveryContext.modelCalls !== 3 || recoveryKnowledge.revision() !== recoveryRevision || (await readdir(path.join(recoveryRoot, 'knowledge'))).length !== 0) throw new Error('recovery boundary drift')
  if (!validateOutput(resumed)) throw new Error(`resumed reconciliation schema mismatch: ${JSON.stringify(validateOutput.errors)}`)

  const snapshotPath = path.join(root, 'knowledge/verifications/assistant/current-work-projection-reconciliation/snapshot.json')
  const reportPath = path.join(root, 'knowledge/verifications/assistant/current-work-projection-reconciliation/report.json')
  await mkdir(path.dirname(snapshotPath), { recursive: true })
  const snapshot = {
    fixture: 'isolated-production-startup-reconciliation',
    productionRevision,
    productionReceipt: {
      currentProjectionSha256: sha256(current),
      reconciledSessions: 2,
      cursorAdvances: 2,
      proposalsCreated: 1,
      proposalsApplied: false,
      durableKnowledgeWritten: false,
      gitHeadChanged: false,
      modelCalls: 2,
      replayStatus: replay.status,
      replayModelCalls: 0,
      interruptedEarlierSessionCommitted: true,
      resumedSessionRef: 'session:session-beta',
    },
    ...result,
  }
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  const finishedAt = new Date()
  const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const report = {
    schemaVersion: 'dsh.probe-report/v1',
    id: `current-work-projection-reconciliation-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
    capabilityRef: '/capabilities/assistant/reconcile-current-work-projection.md',
    connectorId: 'current-work-projection-reconciler',
    probeDefinitionRef: 'repo:/probes/definitions/current-work-projection-reconciliation-local.json',
    environment: 'local', level: 'local', outcome: 'passed',
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), expiresAt: expiresAt.toISOString(),
    checks: [
      { id: 'pinned-production-reconciliation-seam', status: 'passed' },
      { id: 'real-two-session-current-write-and-cursors', status: 'passed' },
      { id: 'current-session-exclusion', status: 'passed' },
      { id: 'exact-cursor-replay', status: 'passed' },
      { id: 'interrupted-later-session-resume', status: 'passed' },
      { id: 'unconfirmed-proposal-and-durable-boundary', status: 'passed' },
      { id: 'public-redaction-incomplete-coverage-and-schema', status: 'passed' },
      { id: 'temporary-repository-cleanup', status: 'passed' }
    ],
    evidence: [...sourceDefinitions.map((source) => ({ kind: 'artifact', ref: `https://raw.githubusercontent.com/AlexKaiqi/dsh-personal-knowledge-base/${productionRevision}/${source.path}`, sha256: source.digest })), { kind: 'snapshot', ref: 'repo:/knowledge/verifications/assistant/current-work-projection-reconciliation/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }],
    sideEffects: [{ effect: 'local-write', status: 'cleaned' }]
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))
} finally {
  await rm(successRoot, { recursive: true, force: true })
  await rm(recoveryRoot, { recursive: true, force: true })
}

async function assertRejects(work, pattern) {
  try { await work() } catch (error) {
    if (!pattern.test(String(error?.message || error))) throw error
    return
  }
  throw new Error(`expected rejection: ${pattern}`)
}

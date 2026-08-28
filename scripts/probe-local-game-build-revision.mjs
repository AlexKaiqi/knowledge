import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { prepareLocalGameBuildRevision } from '../connectors/local-game-build-revision/src/index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sources = [
  {
    id: 'production-revision-primitive',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/domain.mjs',
    digest: '20f1d35eef1c0be4121762ef2bf14443bf766db1dd9c0f962c38543d698eb47a',
    semantics: ['export function stableStringify(value)', 'const revisionHash = sha256(stableStringify(payload))'],
  },
  {
    id: 'production-media-primitive',
    url: 'https://raw.githubusercontent.com/AlexKaiqi/dsh-social-workbench/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/media.mjs',
    digest: 'a703573af97d0741b32b2d9186d24c47c7894a5efce5e044c0fb0dcf220780a2',
    semantics: ['const stream = createReadStream(target)', 'const canonicalPath = await realpath(unresolved)'],
  },
]

const startedAt = new Date()
for (const source of sources) {
  const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${source.id} unavailable: HTTP_${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (sha256(body) !== source.digest) throw new Error(`${source.id} digest mismatch`)
  const text = body.toString('utf8')
  for (const semantic of source.semantics) if (!text.includes(semantic)) throw new Error(`${source.id} semantic missing: ${semantic}`)
}

const fixture = JSON.parse(await readFile(path.join(root, 'probes/fixtures/game-build/revision-input.json'), 'utf8'))
const prepared = await prepareLocalGameBuildRevision(fixture, { workspaceRoot: root, now: () => new Date('2026-08-27T03:00:00Z') })
const replay = await prepareLocalGameBuildRevision(fixture, { workspaceRoot: root, now: () => new Date('2026-08-28T03:00:00Z') })
if (prepared.status !== 'ready' || prepared.revisionHash !== replay.revisionHash) throw new Error('frozen build replay mismatch')
if (prepared.uploaded !== false || prepared.executionAuthorized !== false) throw new Error('platform execution boundary mismatch')
if (JSON.stringify(prepared).includes(root)) throw new Error('public result leaked the local workspace path')

for (const artifact of prepared.artifacts) {
  const bytes = await readFile(path.join(root, fixture.sourceDirectory, artifact.path))
  if (artifact.sha256 !== `sha256:${sha256(bytes)}`) throw new Error(`artifact digest mismatch: ${artifact.path}`)
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'knowledge-game-build-probe-'))
try {
  await mkdir(path.join(temporaryRoot, 'build'))
  await writeFile(path.join(temporaryRoot, 'build/game.bin'), 'first\n')
  const localInput = { ...fixture, sourceDirectory: 'build', entrypoints: ['game.bin'], target: 'desktop-portable' }
  const before = await prepareLocalGameBuildRevision(localInput, { workspaceRoot: temporaryRoot })
  await writeFile(path.join(temporaryRoot, 'build/game.bin'), 'second\n')
  const after = await prepareLocalGameBuildRevision(localInput, { workspaceRoot: temporaryRoot })
  if (before.revisionHash === after.revisionHash) throw new Error('byte mutation did not change revision')
  await writeFile(path.join(temporaryRoot, 'build/.env'), 'SECRET=redacted\n')
  await symlink(path.join(temporaryRoot, 'build/game.bin'), path.join(temporaryRoot, 'build/alias.bin'))
  const blocked = await prepareLocalGameBuildRevision(localInput, { workspaceRoot: temporaryRoot })
  if (blocked.status !== 'blocked' || !blocked.preflight.blockers.some((item) => item.code === 'secret-like-filename') || !blocked.preflight.blockers.some((item) => item.code === 'symlink-not-allowed')) throw new Error('unsafe fixture was not blocked')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

const schema = JSON.parse(await readFile(path.join(root, 'knowledge/schemas/game/prepare-local-build-revision-output.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(prepared)) throw new Error(`game build output schema mismatch: ${JSON.stringify(validate.errors)}`)

const snapshotPath = path.join(root, 'knowledge/verifications/game/local-build-revision/snapshot.json')
const reportPath = path.join(root, 'knowledge/verifications/game/local-build-revision/report.json')
await mkdir(path.dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify({ fixture: 'portable-demo-build', ...prepared }, null, 2)}\n`)
const finishedAt = new Date()
const expiresAt = new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
const report = {
  schemaVersion: 'dsh.probe-report/v1',
  id: `local-game-build-revision-local-${finishedAt.toISOString().slice(0, 10).replaceAll('-', '')}`,
  capabilityRef: '/capabilities/game/prepare-local-build-revision.md',
  connectorId: 'local-game-build-revision',
  probeDefinitionRef: 'repo:/probes/definitions/local-game-build-revision-local.json',
  environment: 'local',
  level: 'local',
  outcome: 'passed',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  checks: [
    { id: 'production-revision-primitive', status: 'passed' },
    { id: 'production-media-primitive', status: 'passed' },
    { id: 'streamed-file-digests', status: 'passed' },
    { id: 'deterministic-replay', status: 'passed' },
    { id: 'byte-change-detection', status: 'passed' },
    { id: 'unsafe-file-blockers', status: 'passed' },
    { id: 'output-schema', status: 'passed' },
    { id: 'non-upload-boundary', status: 'passed' }
  ],
  evidence: [
    ...sources.map((source) => ({ kind: 'artifact', ref: source.url, sha256: source.digest })),
    { kind: 'snapshot', ref: 'repo:/knowledge/verifications/game/local-build-revision/snapshot.json', sha256: sha256(await readFile(snapshotPath)) }
  ],
  sideEffects: [{ effect: 'none', status: 'none' }]
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outcome: report.outcome, report: reportPath, snapshot: snapshotPath, expiresAt: report.expiresAt }, null, 2))

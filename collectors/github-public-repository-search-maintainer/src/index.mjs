import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { searchPublicRepositories } from '../../../connectors/github-public-repository-search/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { query: 'xiaohongshu-mcp in:name user:xpzouying', perPage: 5, page: 1 }
const expectedRepository = 'xpzouying/xiaohongshu-mcp'

function stableRepository(repository) {
  if (!repository) return null
  return {
    id: repository.id,
    fullName: repository.fullName,
    defaultBranch: repository.defaultBranch,
    archived: repository.archived,
    disabled: repository.disabled,
    visibility: repository.visibility,
    licenseSpdx: repository.licenseSpdx,
  }
}

export async function collectGitHubRepositorySearchMaintenance({ now = () => new Date(), reader = searchPublicRepositories } = {}) {
  const observedAt = now()
  const proposals = []
  let acceptedSnapshot = null
  let report = null
  try {
    acceptedSnapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-search/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-search/report.json'), 'utf8'))
  } catch {}
  try {
    const current = await reader(fixtureInput)
    const currentFixture = current.repositories.find((repository) => repository.fullName === expectedRepository)
    const acceptedFixture = acceptedSnapshot?.repositories?.find((repository) => repository.fullName === expectedRepository)
    if (current.conformance.status !== 'passed') proposals.push({ kind: 'connector-change-proposal', action: 'review-github-search-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    if (!currentFixture) proposals.push({ kind: 'knowledge-proposal', action: 'replace-missing-search-fixture', expectedRepository })
    else if (acceptedFixture && JSON.stringify(stableRepository(currentFixture)) !== JSON.stringify(stableRepository(acceptedFixture))) proposals.push({ kind: 'knowledge-proposal', action: 'review-search-fixture-metadata-change', previous: stableRepository(acceptedFixture), current: stableRepository(currentFixture) })
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-github-search-baseline' })
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-search-live.json' })
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-github-search-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGitHubRepositorySearchMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { listPublicRepositoryTags } from '../../../connectors/github-public-repository-tags/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureInput = { owner: 'tamnd', repository: 'xiaohongshu-cli', maxTags: 200 }
const expectedTags = {
  'v0.1.0': '1508229cfa4b1437e0cb2e76b03dbfda42b23b4f',
  'v0.2.0': '96743ceff24452073b3571c1b07f6ce75bb223bb',
}

function stableTagSet(result) {
  if (!result?.tags) return null
  return {
    repositoryUrl: result.repositoryUrl,
    tagSetComplete: result.coverage?.tagSetComplete,
    tags: result.tags,
    tagSetDigest: result.tagSetDigest,
  }
}

async function readAcceptedState() {
  let snapshot = null
  let report = null
  try {
    snapshot = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-tags/snapshot.json'), 'utf8'))
    report = JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/github/public-repository-tags/report.json'), 'utf8'))
  } catch {}
  return { snapshot, report }
}

export async function collectGitHubPublicRepositoryTagsMaintenance({ now = () => new Date(), reader = listPublicRepositoryTags, acceptedState } = {}) {
  const observedAt = now()
  const proposals = []
  const { snapshot: acceptedSnapshot, report } = acceptedState ?? await readAcceptedState()
  try {
    const current = await reader(fixtureInput)
    if (current.conformance.status !== 'passed') {
      proposals.push({ kind: 'connector-change-proposal', action: 'review-github-repository-tags-contract', failures: current.conformance.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.id) })
    }
    if (!current.coverage.tagSetComplete) proposals.push({ kind: 'knowledge-proposal', action: 'replace-or-expand-tag-fixture', maximumTags: fixtureInput.maxTags })
    const tagsByName = Object.fromEntries(current.tags.map((tag) => [tag.name, tag.commitSha]))
    const missingOrMoved = Object.entries(expectedTags).filter(([name, sha]) => tagsByName[name] !== sha).map(([name]) => name)
    if (missingOrMoved.length > 0) proposals.push({ kind: 'knowledge-proposal', action: 'review-known-tag-identity-change', tags: missingOrMoved })
    if (!acceptedSnapshot) proposals.push({ kind: 'knowledge-proposal', action: 'establish-github-repository-tags-baseline' })
    else if (JSON.stringify(stableTagSet(current)) !== JSON.stringify(stableTagSet(acceptedSnapshot))) {
      proposals.push({ kind: 'knowledge-proposal', action: 'review-github-repository-tag-set-change', previous: stableTagSet(acceptedSnapshot), current: stableTagSet(current) })
    }
    if (!report || Date.parse(report.expiresAt) <= observedAt.getTime()) {
      proposals.push({ kind: 'verification-report', action: 'rerun-live-probe', probeDefinitionRef: 'repo:/probes/definitions/github-public-repository-tags-live.json' })
    }
    return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
  } catch (error) {
    if (error?.code === 'rate-limited') {
      return {
        observedAt: observedAt.toISOString(),
        status: 'deferred',
        proposals: [{
          kind: 'verification-report',
          action: 'rerun-after-rate-limit-reset',
          reason: 'github-core-rate-limit',
          ...(error.retryAt ? { notBefore: error.retryAt } : {}),
        }],
      }
    }
    return { observedAt: observedAt.toISOString(), status: 'unreachable', proposals: [{ kind: 'connector-change-proposal', action: 'restore-github-repository-tags-access', detail: error.message }] }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await collectGitHubPublicRepositoryTagsMaintenance()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'unreachable') process.exitCode = 1
}

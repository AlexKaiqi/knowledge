import { listPublicRepositoryTags, parsePublicGitHubRepositoryUrl } from '../../connectors/github-public-repository-tags/src/index.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

export function selectReleaseWatchProjects(projectCatalog, observedAt, count = 4) {
  if (!Number.isInteger(count) || count < 1) throw new Error('release watch count must be a positive integer')
  const eligible = projectCatalog.projects.filter((project) =>
    project.watch.reviewOn.includes('release') && projectCatalog.releaseTagBaselines?.[project.id])
  if (eligible.length === 0) return []
  const dayIndex = Math.floor(observedAt.getTime() / DAY_MS)
  const start = (dayIndex * count) % eligible.length
  return Array.from({ length: Math.min(count, eligible.length) }, (_, offset) => eligible[(start + offset) % eligible.length])
}

export async function readPublicGitHubReleaseTagState(repository, { maxTags = 200, reader = listPublicRepositoryTags } = {}) {
  const input = { ...parsePublicGitHubRepositoryUrl(repository), maxTags }
  const result = await reader(input)
  if (result.conformance.status !== 'passed') {
    const error = new Error('GitHub repository tag Connector requires contract review')
    error.code = 'connector-contract-review'
    throw error
  }
  if (!result.coverage.tagSetComplete) {
    const error = new Error(`GitHub repository tag set exceeds the ${maxTags}-tag maintenance budget`)
    error.code = 'tag-set-truncated'
    throw error
  }
  return { tagCount: result.coverage.returnedCount, digest: result.tagSetDigest }
}

const defaultReleaseTags = (repository) => readPublicGitHubReleaseTagState(repository)

export async function observeProjectReleaseTags({ projects, baselines, releaseTags = defaultReleaseTags }) {
  const observations = []
  for (const project of projects) {
    const baseline = baselines[project.id]
    try {
      const current = await releaseTags(project.repository, project)
      observations.push({
        projectId: project.id,
        repository: project.repository,
        status: current.tagCount === baseline.tagCount && current.digest === baseline.digest ? 'current' : 'review-required',
        baseline,
        current,
      })
    } catch (error) {
      const status = error?.code === 'rate-limited'
        ? 'deferred'
        : error?.code === 'tag-set-truncated'
          ? 'budget-review'
          : error?.code === 'connector-contract-review'
            ? 'contract-review'
            : 'unreachable'
      observations.push({
        projectId: project.id,
        repository: project.repository,
        status,
        baseline,
        detail: error.message,
        ...(error?.retryAt ? { notBefore: error.retryAt } : {}),
      })
    }
  }
  return observations
}

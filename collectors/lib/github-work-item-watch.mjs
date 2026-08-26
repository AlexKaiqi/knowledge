import { listPublicRepositoryWorkItemChanges } from '../../connectors/github-public-repository-work-item-changes/src/index.mjs'
import { parsePublicGitHubRepositoryUrl } from '../../connectors/github-public-repository-tags/src/index.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

export function selectWorkItemWatchProjects(projectCatalog, observedAt, count = 1) {
  if (!Number.isInteger(count) || count < 1) throw new Error('work-item watch count must be a positive integer')
  const eligible = projectCatalog.projects.filter((project) =>
    project.watch.reviewOn.includes('issue-change') && projectCatalog.workItemCheckpoints?.[project.id])
  if (eligible.length === 0) return []
  const dayIndex = Math.floor(observedAt.getTime() / DAY_MS)
  const start = (dayIndex * count) % eligible.length
  return Array.from({ length: Math.min(count, eligible.length) }, (_, offset) => eligible[(start + offset) % eligible.length])
}

const defaultReader = async (repository, checkpoint) => listPublicRepositoryWorkItemChanges({
  ...parsePublicGitHubRepositoryUrl(repository),
  checkpoint,
  maxItems: 100,
})

export async function observeProjectWorkItemChanges({ projects, checkpoints, workItemChanges = defaultReader }) {
  const observations = []
  for (const project of projects) {
    const checkpoint = checkpoints[project.id]
    try {
      const current = await workItemChanges(project.repository, checkpoint, project)
      const status = current.conformance.status !== 'passed'
        ? 'contract-review'
        : !current.coverage.complete
          ? 'budget-review'
          : current.items.length > 0
            ? 'review-required'
            : 'current'
      observations.push({
        projectId: project.id,
        repository: project.repository,
        status,
        checkpoint,
        nextCheckpoint: current.nextCheckpoint,
        coverage: current.coverage,
        changes: current.items,
        rateLimit: current.rateLimit,
      })
    } catch (error) {
      const status = error?.code === 'rate-limited'
        ? 'deferred'
        : error?.code === 'repository-not-found'
          ? 'missing'
          : 'unreachable'
      observations.push({
        projectId: project.id,
        repository: project.repository,
        status,
        checkpoint,
        detail: error.message,
        ...(error?.retryAt ? { notBefore: error.retryAt } : {}),
      })
    }
  }
  return observations
}

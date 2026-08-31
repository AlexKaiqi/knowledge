import assert from 'node:assert/strict'
import { access, readdir } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('repository initializes every responsibility boundary', async () => {
  const required = [
    'knowledge/index.md',
    'knowledge/log.md',
    'knowledge/platforms/index.md',
    'knowledge/services/index.md',
    'knowledge/tools/index.md',
    'knowledge/sources/index.md',
    'knowledge/concepts/index.md',
    'knowledge/capabilities/index.md',
    'knowledge/schemas/index.md',
    'knowledge/policies/index.md',
    'knowledge/verifications/index.md',
    'knowledge/references/index.md',
    'connectors/README.md',
    'collectors/README.md',
    'probes/README.md',
    'spec/README.md',
  ]
  await Promise.all(required.map((path) => access(new URL(path, root))))
})

async function markdownInstances(directory, prefix = '') {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true })
  const paths = []
  for (const entry of entries) {
    if (entry.name === 'index.md' || entry.name === 'README.md') continue
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory()) paths.push(...await markdownInstances(`${directory}${entry.name}/`, `${relative}/`))
    else if (entry.name.endsWith('.md')) paths.push(relative)
  }
  return paths.sort()
}

test('canonical knowledge contains only probe-admitted subject and capability files', async () => {
  assert.deepEqual(await markdownInstances('knowledge/platforms/'), ['apple-app-store.md', 'douyin.md', 'github.md', 'hugging-face-hub.md', 'steam.md', 'tiktok.md', 'xiaohongshu.md'])
  assert.deepEqual(await markdownInstances('knowledge/services/'), [])
  assert.deepEqual(await markdownInstances('knowledge/sources/'), ['arxiv.md', 'douyin-open-platform.md', 'xiaohongshu-account-api.md', 'xiaohongshu-community-rules.md'])
  assert.deepEqual(await markdownInstances('knowledge/tools/'), ['action-impact-review-revision.md', 'bounded-work-context-projection.md', 'consented-feedback-intake-revision.md', 'current-work-projection-maintainer.md', 'current-work-projection-reconciler.md', 'distribution-impact-observation-evaluator.md', 'duplex-turn-policy-projector.md', 'durable-memory-change-review-revision.md', 'evidence-backed-research.md', 'feedback-intake-local-retention-expiry.md', 'feedback-intake-local-store.md', 'feedback-intake-local-withdrawal.md', 'feedback-observation-reconciler.md', 'feedback-theme-synthesis.md', 'local-game-build-revision.md', 'memory-action-grounding.md', 'multi-turn-response-repetition-observer.md', 'optifeed-radar.md', 'persona-continuity-evaluator.md', 'proactive-contact-review-revision.md', 'public-state-pet-behavior-projector.md', 'steam-content-survey-revision.md', 'steam-early-access-revision.md', 'steam-initial-base-price-revision.md', 'steam-initial-release-date-revision.md', 'steam-review-observation-projector.md', 'steam-store-asset-revision.md', 'steam-store-description-revision.md', 'steam-store-tag-revision.md', 'steam-supported-feature-revision.md', 'steam-system-requirements-revision.md', 'versioned-memory-use-evaluator.md'])
  assert.deepEqual(await markdownInstances('knowledge/capabilities/'), [
    'arxiv/search-public-eprint-metadata.md',
    'assistant/evaluate-persona-continuity-suite.md',
    'assistant/evaluate-versioned-memory-use-suite.md',
    'assistant/ground-memory-into-action-candidate.md',
    'assistant/maintain-current-work-projection.md',
    'assistant/observe-multi-turn-response-repetition.md',
    'assistant/prepare-action-impact-review-revision.md',
    'assistant/prepare-durable-memory-change-review-revision.md',
    'assistant/prepare-proactive-contact-review-revision.md',
    'assistant/read-bounded-work-context.md',
    'assistant/reconcile-current-work-projection.md',
    'distribution/audit-store-ai-readiness.md',
    'distribution/evaluate-impact-observation-set.md',
    'douyin/read-open-platform-surface.md',
    'douyin/read-public-video-embed.md',
    'feedback/expire-consented-intake-record.md',
    'feedback/persist-consented-intake-revision.md',
    'feedback/prepare-consented-intake-review-revision.md',
    'feedback/reconcile-feedback-observations.md',
    'feedback/synthesize-feedback-theme-evidence.md',
    'feedback/withdraw-consented-intake-record.md',
    'game/prepare-local-build-revision.md',
    'github/list-public-repository-tags.md',
    'github/list-public-repository-work-item-changes.md',
    'github/read-public-repository-file.md',
    'github/read-public-repository-release-by-tag.md',
    'github/search-public-repositories.md',
    'hugging-face/read-public-model-revision-manifest.md',
    'pet/project-public-state-to-behavior.md',
    'research/conduct-evidence-backed-research.md',
    'research/search-public-app-catalog.md',
    'steam/prepare-content-survey-review-revision.md',
    'steam/prepare-early-access-review-revision.md',
    'steam/prepare-initial-base-price-review-revision.md',
    'steam/prepare-initial-release-date-review-revision.md',
    'steam/prepare-store-asset-review-revision.md',
    'steam/prepare-store-description-review-revision.md',
    'steam/prepare-store-tag-review-revision.md',
    'steam/prepare-supported-feature-review-revision.md',
    'steam/prepare-system-requirements-review-revision.md',
    'steam/project-review-page-to-observation-window.md',
    'steam/read-public-game-review-page.md',
    'tiktok/read-public-video-embed.md',
    'voice/project-duplex-turn-events-to-actions.md',
    'xiaohongshu/list-owned-notes.md',
    'xiaohongshu/read-account-api-surface.md',
    'xiaohongshu/read-community-rule-surface.md',
  ])
})

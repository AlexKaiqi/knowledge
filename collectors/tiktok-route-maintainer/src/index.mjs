import process from 'node:process'

const POLICY_SOURCE_IDS = new Set(['tiktok-research-product', 'tiktok-research-faq', 'tiktok-content-posting', 'tiktok-direct-post'])
export function collectTikTokRouteMaintenance({ sourceChanges = [], routeHealth = [], now = () => new Date() } = {}) {
  const proposals = []
  for (const change of sourceChanges) proposals.push({ kind: POLICY_SOURCE_IDS.has(change.id) ? 'knowledge-proposal' : 'connector-change-proposal', action: 'review-tiktok-access-route-source-change', sourceId: change.id, previous: change.previous, current: change.current })
  for (const route of routeHealth.filter((item) => item.status !== 'current')) proposals.push({ kind: 'connector-change-proposal', action: 'review-tiktok-route-health', routeId: route.id, status: route.status })
  return { observedAt: now().toISOString(), status: proposals.length ? 'review-required' : 'current-research-boundaries', proposals }
}

if (process.argv[1] === new URL(import.meta.url).pathname) process.stdout.write(`${JSON.stringify(collectTikTokRouteMaintenance(), null, 2)}\n`)

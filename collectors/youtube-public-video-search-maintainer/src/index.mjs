import process from 'node:process'

export const YOUTUBE_SOURCE_REFS = Object.freeze([
  'https://developers.google.com/youtube/v3/docs/search/list',
  'https://developers.google.com/youtube/v3/getting-started',
  'https://developers.google.com/youtube/v3/determine_quota_cost',
  'https://developers.google.com/youtube/terms/developer-policies',
  'https://developers.google.com/youtube/v3/revision_history',
])

export function collectYouTubePublicVideoSearchMaintenance({ sourceChanges = [], probeReport = null, now = () => new Date() } = {}) {
  const proposals = sourceChanges.map((change) => ({ kind: change.id === 'youtube-policy' ? 'knowledge-proposal' : 'connector-change-proposal', action: 'review-youtube-public-video-search-source-change', sourceId: change.id, previous: change.previous, current: change.current }))
  if (probeReport?.outcome === 'passed' && Date.parse(probeReport.expiresAt) > now().getTime()) proposals.push({ kind: 'knowledge-proposal', action: 'review-youtube-public-video-search-admission', reportRef: probeReport.ref })
  return { observedAt: now().toISOString(), status: proposals.length ? 'review-required' : 'candidate-awaiting-approved-identity-and-live-probe', sourceRefs: YOUTUBE_SOURCE_REFS, proposals }
}

if (process.argv[1] === new URL(import.meta.url).pathname) process.stdout.write(`${JSON.stringify(collectYouTubePublicVideoSearchMaintenance(), null, 2)}\n`)

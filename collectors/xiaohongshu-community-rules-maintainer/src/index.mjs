import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readCommunityRuleSurface } from '../../../connectors/xiaohongshu-community-rules-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export async function collectCommunityRulesMaintenance({ observation, acceptedSnapshot, verificationReport, now = () => new Date() } = {}) {
  const observedAt = now()
  if (!observation) return { observedAt: observedAt.toISOString(), status: 'browser-required', proposals: [{ kind: 'knowledge-proposal', action: 'run-read-only-rendered-rule-observation' }] }
  const current = readCommunityRuleSurface(observation)
  const accepted = acceptedSnapshot ?? JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/xiaohongshu/community-rules/snapshot.json'), 'utf8'))
  const report = verificationReport ?? JSON.parse(await readFile(path.join(repositoryRoot, 'knowledge/verifications/xiaohongshu/community-rules/report.json'), 'utf8'))
  const proposals = []
  if (current.conformance.status !== 'passed') proposals.push({ kind: 'knowledge-proposal', action: 'review-community-rule-semantic-change' })
  if (current.semanticDigest !== accepted.semanticDigest) proposals.push({ kind: 'knowledge-proposal', action: 'review-community-rule-digest-change', previousDigest: accepted.semanticDigest, currentDigest: current.semanticDigest })
  if (Date.parse(report.expiresAt) <= observedAt.getTime()) proposals.push({ kind: 'verification-report', action: 'rerun-expired-live-probe' })
  return { observedAt: observedAt.toISOString(), status: proposals.length === 0 ? 'current' : 'review-required', proposals, current }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const observationPath = process.env.KNOWLEDGE_XHS_COMMUNITY_RULES_OBSERVATION
  const observation = observationPath ? JSON.parse(await readFile(observationPath, 'utf8')) : undefined
  process.stdout.write(`${JSON.stringify(await collectCommunityRulesMaintenance({ observation }), null, 2)}\n`)
}

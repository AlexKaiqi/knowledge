import { createHash } from 'node:crypto'

export const SOURCE_URL = 'https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4'
const EXPECTED_TITLE = '小红书社区公约2.0'
const EXPECTED_PUBLISHED_AT = '2026-07-31 18:15:12'
const EXPECTED_SECTIONS = ['一、真诚分享', '二、友好互动', '三、有序经营']
const EXPECTED_RULE_COUNT = 25
const OBLIGATIONS = [
  { id: 'originality-and-authenticity', markers: ['尊重原创', '真实的内容'] },
  { id: 'disclose-ai-assistance', markers: ['AI辅助工具', '主动标明'] },
  { id: 'no-impersonation', markers: ['不要冒充他人'] },
  { id: 'protect-privacy-and-reject-doxxing', markers: ['尊重他人隐私', '拒绝人肉搜索'] },
  { id: 'no-fabricated-performance-data', markers: ['不伪造数据'] },
  { id: 'use-platform-transaction-tools', markers: ['通过平台提供的工具完成交易'] },
  { id: 'no-infringement', markers: ['不要通过侵权手段'] },
]

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function readCommunityRuleSurface(observation) {
  if (!observation || typeof observation !== 'object') throw new Error('rendered observation is required')
  const title = clean(observation.title)
  const publishedAt = clean(observation.publishedAt)
  const h1 = (observation.h1 ?? []).map(clean).filter(Boolean)
  const ruleHeadings = (observation.ruleHeadings ?? []).map(clean).filter(Boolean)
  const sections = h1.filter((heading) => heading !== title)
  const obligations = OBLIGATIONS.map((obligation) => ({
    id: obligation.id,
    documented: ruleHeadings.some((heading) => obligation.markers.every((marker) => heading.includes(marker))),
  }))
  const assertions = [
    { id: 'official-title', passed: title === EXPECTED_TITLE },
    { id: 'published-version', passed: publishedAt === EXPECTED_PUBLISHED_AT },
    { id: 'top-level-sections', passed: JSON.stringify(sections) === JSON.stringify(EXPECTED_SECTIONS) },
    { id: 'rule-heading-count', passed: ruleHeadings.length === EXPECTED_RULE_COUNT },
    { id: 'selected-obligations', passed: obligations.every((obligation) => obligation.documented) },
  ]
  const projection = {
    source: { id: 'xiaohongshu-community-rules-2', url: observation.sourceUrl ?? SOURCE_URL },
    title,
    publishedAt,
    sections,
    ruleHeadingCount: ruleHeadings.length,
    obligations,
  }
  return {
    ...projection,
    observedAt: clean(observation.observedAt),
    semanticDigest: digest({ ...projection, ruleHeadings }),
    conformance: {
      status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required',
      assertions,
    },
  }
}

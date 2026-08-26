import assert from 'node:assert/strict'
import test from 'node:test'
import { readCommunityRuleSurface, SOURCE_URL } from '../src/index.mjs'

const headings = [
  '请尊重原创，并分享真实的内容',
  '如果你在创作中使用了AI辅助工具，请主动标明',
  '请不要冒充他人',
  '请尊重他人隐私，拒绝人肉搜索，不发起、不参与任何形式的网络暴力',
  '请不要虚构服务和产品功效，不伪造数据，用真实信息赢取用户长久信任',
  '请通过平台提供的工具完成交易，以保障买卖双方的权益，共同维护安全、放心的交易环境',
  '请不要通过侵权手段达成经营目的',
  ...Array.from({ length: 18 }, (_, index) => `其它规则 ${index + 1}`),
]

function observation(overrides = {}) {
  return {
    sourceUrl: SOURCE_URL,
    title: '小红书社区公约2.0',
    publishedAt: '2026-07-31 18:15:12',
    h1: ['小红书社区公约2.0', '一、真诚分享', '二、友好互动', '三、有序经营'],
    ruleHeadings: headings,
    observedAt: '2026-08-26T16:53:05Z',
    ...overrides,
  }
}

test('normalizes the accepted rendered rule surface', () => {
  const result = readCommunityRuleSurface(observation())
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.ruleHeadingCount, 25)
  assert.equal(result.obligations.every((item) => item.documented), true)
  assert.equal(result.semanticDigest.length, 64)
})

test('requires review when the official rule structure changes', () => {
  const result = readCommunityRuleSurface(observation({ ruleHeadings: headings.slice(0, -1) }))
  assert.equal(result.conformance.status, 'review-required')
  assert.equal(result.conformance.assertions.find((item) => item.id === 'rule-heading-count').passed, false)
})

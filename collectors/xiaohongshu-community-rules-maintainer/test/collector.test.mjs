import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCommunityRulesMaintenance } from '../src/index.mjs'
import { readCommunityRuleSurface, SOURCE_URL } from '../../../connectors/xiaohongshu-community-rules-browser/src/index.mjs'

const observation = {
  sourceUrl: SOURCE_URL,
  title: '小红书社区公约2.0',
  publishedAt: '2026-07-31 18:15:12',
  h1: ['小红书社区公约2.0', '一、真诚分享', '二、友好互动', '三、有序经营'],
  ruleHeadings: [
    '尊重原创并分享真实的内容',
    '使用AI辅助工具请主动标明',
    '不要冒充他人',
    '尊重他人隐私并拒绝人肉搜索',
    '不伪造数据',
    '通过平台提供的工具完成交易',
    '不要通过侵权手段',
    ...Array.from({ length: 18 }, (_, index) => `其它规则 ${index + 1}`),
  ],
  observedAt: '2026-08-26T16:53:05Z',
}

test('requests a rendered observation instead of hashing an SPA shell', async () => {
  const result = await collectCommunityRulesMaintenance()
  assert.equal(result.status, 'browser-required')
  assert.equal(result.proposals[0].action, 'run-read-only-rendered-rule-observation')
})

test('keeps the reviewed rendered rule surface current', async () => {
  const current = readCommunityRuleSurface(observation)
  const result = await collectCommunityRulesMaintenance({
    observation,
    acceptedSnapshot: { semanticDigest: current.semanticDigest },
    verificationReport: { expiresAt: '2026-09-02T00:00:00Z' },
    now: () => new Date('2026-08-27T00:00:00Z'),
  })
  assert.equal(result.status, 'current')
  assert.deepEqual(result.proposals, [])
})

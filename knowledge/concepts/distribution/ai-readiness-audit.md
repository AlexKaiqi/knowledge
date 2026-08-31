---
type: Concept
title: AI Readiness Audit
description: 对公开站点的 crawler access、结构化数据、llms 文件、meta 基础和 sitemap 做出的有界时点审计。
tags: [distribution, ecommerce, ai-readiness, point-in-time, non-visibility]
generated: { by: connector:optifeed-radar-ai-readiness, at: 2026-08-31T15:23:02.625Z }
verified:
  - { by: probe:optifeed-radar-ai-readiness-live-20260831, at: 2026-08-31T15:57:28.081Z }
status: experimental
stale_after: 2026-09-07T15:57:28.081Z
sources:
  - id: upstream-methodology
    resource: https://github.com/optifeed/optifeed-radar/blob/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b/METHODOLOGY.md
    title: Optifeed Radar methodology
    author: organization:optifeed
  - id: verified-snapshot
    resource: ../../verifications/distribution/ai-readiness-audit/snapshot.json
    title: Verified Optifeed Radar readiness audit snapshot
    author: connector:optifeed-radar-ai-readiness
---

# AI Readiness Audit

Readiness score 只描述一次公开站点技术面观察，不是 AI Visibility Score，也不证明 ChatGPT、Claude、Gemini、Perplexity 或任何购物 Agent 会推荐品牌或商品。

五个分项权重来自固定上游 revision：AI crawler access 40、structured data 25、`llms.txt` 15、meta basics 15、sitemap 5。Crawler access 只按当次 `robots.txt` 对站点根路径的规则判断；它不证明 crawler 实际抓取、索引或使用了内容。Sitemap 只采样最多三张页面，未声明完整覆盖。

结果是 nondeterministic 的时点观察：页面、DNS、重定向和上游评分方法变化都会改变结果。任何整改与发布决定仍需人审。

- [输出 Schema](../../schemas/distribution/audit-store-ai-readiness-output.schema.json)
- [验证快照](../../verifications/distribution/ai-readiness-audit/snapshot.json)

---
type: Capability
title: 搜索公开应用目录
description: 按关键词、storefront country 和设备 surface 读取最多 25 个 Apple App Store 应用的最小公开元数据页。
tags: [research, app-store, apps, search, competitor-discovery, metadata]
outcomes: [demand-discovery, product-research]
generated: { by: connector:apple-public-app-search, at: 2026-08-27T05:26:44Z }
verified:
  - { by: probe:apple-public-app-search-live-20260827, at: 2026-08-27T05:26:44Z }
status: experimental
stale_after: 2026-09-03T05:26:44Z
sources:
  - id: subject
    resource: ../../platforms/apple-app-store.md
    title: Apple App Store
    author: organization:apple
  - id: search-api-overview
    resource: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html
    title: iTunes Search API — Overview
    author: organization:apple
  - id: search-api-contract
    resource: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
    title: iTunes Search API — Constructing Searches
    author: organization:apple
  - id: live-report
    resource: ../../verifications/apple/public-app-search/report.json
    title: Apple public app search live verification
    author: probe:apple-public-app-search-live
capability:
  id: research.search-public-app-catalog
  version: 1.0.0
  subjectRef: /platforms/apple-app-store.md
  kind: query
  effect: none
  inputSchema: /schemas/research/search-public-app-catalog-input.schema.json
  outputSchema: /schemas/research/search-public-app-catalog-output.schema.json
  resultConcepts: [/concepts/research/public-app-catalog-search-page.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只使用 Apple 文档化 Search API 的匿名公开元数据；不抓取 Apple 页面、不保留 promotional artwork/description、不创建排名、不读取评论正文，也不把结果转售或冒充完整市场数据。
verification:
  level: live
  report: /verifications/apple/public-app-search/report.json
---

# 搜索公开应用目录

输入是 2–100 字符纯查询、两位国家代码、`iphone|ipad|mac` surface 和最多 25 条结果。内部执行固定官方 endpoint、software media、对应 entity、`explicit=No` 和 response version；调用者不能指定 URL、任意 Apple 参数或大批量分页。

输出适合为个人助理/宠物、游戏或其它产品寻找 App 候选，核对应用身份、开发者、类别、当前版本、版本时间、价格和评分摘要。结果应作为 `market-competitive` 或 `demand` 调研的输入证据之一，而不是直接结论。

能力有意不承诺：关键词排名、榜单、全量结果、历史变化、评论内容、评分变化、市场规模或需求强度。官方文档已归档，且只验证过一个 US iPhone 小页，因此保持 experimental 并以七天 live freshness 维护。

2026-08-27 live probe 对 US iPhone storefront 搜索 `ChatGPT`，返回 5 个应用并包含 App ID `6448311069`；页面边界、最小元数据、官方链接、无凭据、无重试、无排名/总量主张和公共 Schema 全部通过。未验证 CN、iPad、Mac、其它查询或长期调用稳定性。

- [输入 Schema](../../schemas/research/search-public-app-catalog-input.schema.json)
- [输出 Schema](../../schemas/research/search-public-app-catalog-output.schema.json)
- [验证报告](../../verifications/apple/public-app-search/report.json)

---
type: Platform
title: Apple App Store
description: 通过 Apple 文档化的公开 Search API 检索有界应用元数据，用于竞品发现、版本与定价观察；不把返回顺序解释为榜单或市场规模。
tags: [apple, app-store, apps, product-research, competitor-discovery, metadata]
generated: { by: connector:apple-public-app-search, at: 2026-08-27T05:26:44Z }
verified:
  - { by: probe:apple-public-app-search-live-20260827, at: 2026-08-27T05:26:44Z }
status: experimental
stale_after: 2026-09-03T05:26:44Z
sources:
  - id: search-api-overview
    resource: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html
    title: iTunes Search API — Overview
    author: organization:apple
  - id: search-api-contract
    resource: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
    title: iTunes Search API — Constructing Searches
    author: organization:apple
  - id: app-review-guidelines
    resource: https://developer.apple.com/app-store/review/guidelines/
    title: App Review Guidelines 4.5.1
    author: organization:apple
  - id: live-report
    resource: ../verifications/apple/public-app-search/report.json
    title: Apple public app search live verification
    author: probe:apple-public-app-search-live
---

# Apple App Store

当前准入范围只有 Apple 文档化的 Search API：按关键词、两位 storefront country 与 `iphone|ipad|mac` surface 返回最多 25 个应用的公开元数据。结果用于发现候选竞品、核对应用身份、版本、版本更新时间、价格、类别和评分摘要，再交给证据化调研形成结论。

Apple 将这套文档放在 Documentation Archive。官方页面说明 software 可选择 `software`、`iPadSoftware` 和 `macSoftware` entity，Search API 约限制为每分钟 20 次。当前 Connector 每次只发送一个串行请求、至少间隔三秒且不自动重试；它不抓取 App Store HTML。

返回顺序的排名含义没有被官方契约定义，`resultCount` 只是本页返回数量。它们不能被解释为榜单、关键词排名、市场规模、需求强度、份额或稳定 checkpoint。Apple App Review Guidelines 4.5.1 还禁止抓取 Apple 站点和用这类信息创建 rankings；当前能力因此明确不提供排名计算，也不使用未获当前官方批准证据的 customer-review RSS。

当前未准入：公开竞品评论正文、榜单、历史变化、自有 App 评论、App Store Connect 发布/审核、开发者回复和任何写操作。自有 App 评论需要另一个 authorized Capability；Apple/Google 竞品评论需要经过许可和付费 live probe 的商业数据路线。

- [搜索公开应用目录](../capabilities/research/search-public-app-catalog.md)
- [公开应用搜索页概念](../concepts/research/public-app-catalog-search-page.md)
- [验证报告](../verifications/apple/public-app-search/report.json)

---
type: Concept
title: Public App Catalog Search Page
description: 一个按 storefront 和设备 surface 有界观察的公开应用元数据页面；结果集可变，顺序、数量和评分不构成排名或需求结论。
tags: [app-store, apps, metadata, bounded-search-page, competitor-discovery]
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
  - id: search-api-contract
    resource: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
    title: iTunes Search API — Constructing Searches
    author: organization:apple
  - id: live-report
    resource: ../../verifications/apple/public-app-search/report.json
    title: Apple public app search live verification
    author: probe:apple-public-app-search-live
---

# Public App Catalog Search Page

页面身份由查询词、storefront country、`iphone|ipad|mac` surface 和请求上限共同确定。每个 item 只保留稳定应用 ID、bundle ID、名称、开发者、类别、版本与时间、价格、评分摘要和 canonical store link；描述、release notes、artwork、设备清单、支持链接与原始响应不属于这个 Concept。

页面是一次时间点观察：结果集会变化，不提供历史，也没有稳定分页或 delta checkpoint。`returnedCount` 只表示当前页面长度；`corpusComplete=false` 固定为真。返回顺序只按原 API 保存，`rankingSemantics=apple-search-api-unspecified`，不能推导 App Store 排名、搜索份额或可见度。

评分只是 storefront 当前返回的聚合摘要。它不能替代评论内容、样本构成、评分变化或用户问题证据；研究结论仍需与评论、版本说明、用户材料和反证结合。

- [输出 Schema](../../schemas/research/search-public-app-catalog-output.schema.json)
- [验证快照](../../verifications/apple/public-app-search/snapshot.json)

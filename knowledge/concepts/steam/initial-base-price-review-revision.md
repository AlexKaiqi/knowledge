---
type: Concept
title: SteamInitialBasePriceReviewRevision
description: 将未发布标准基础包、完整区域基础价格、阈值观察、商业证据和审核后发布模式绑定在一起的内容寻址待审对象。
tags: [steam, pricing, revision, regional-pricing, human-review]
generated: { by: connector:steam-initial-base-price-revision, at: 2026-08-27T11:01:10.027Z }
verified:
  - { by: probe:steam-initial-base-price-review-revision-local-20260827, at: 2026-08-27T11:01:10.027Z }
status: stable
stale_after: 2026-09-26T11:01:10.027Z
sources:
  - id: capability
    resource: ../../capabilities/steam/prepare-initial-base-price-review-revision.md
    title: 准备 Steam 初始基础价格审阅 Revision
    author: capability:steam.prepare-initial-base-price-review-revision
  - id: verified-snapshot
    resource: ../../verifications/steam/initial-base-price-review-revision/snapshot.json
    title: Verified Steam initial base-price review revision
    author: probe:steam-initial-base-price-review-revision-local
---

# SteamInitialBasePriceReviewRevision

该 Revision 精确绑定一个未发布游戏的标准基础 package、当前 build、定价语义/catalog/minimum observation revisions，以及 37 个 live currencies 与四个 USD region groups 的基础价格。金额使用最小货币单位，不依赖浮点数或本地化显示字符串。

`ready-for-human-review` 只表示本地结构、完整覆盖、调用方观察最低值和公开步进规则通过。对象固定声明目录和最低阈值没有在认证后台核验，也没有生成 CSV、提交 Valve、获得批准或发布；折扣和后续调价不属于该对象。

- [输出 Schema](../../schemas/steam/prepare-initial-base-price-review-revision-output.schema.json)
- [验证样本](../../verifications/steam/initial-base-price-review-revision/snapshot.json)

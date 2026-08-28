---
type: Tool
title: Steam 初始基础价格 Revision 准备器
description: 冻结标准基础包的完整 Steam 区域价格、阈值观察和决策证据，生成待人审且无平台副作用的 Revision。
tags: [steam, pricing, regional-pricing, game-publishing, preflight]
generated: { by: connector:steam-initial-base-price-revision, at: 2026-08-27T11:01:10.027Z }
verified:
  - { by: probe:steam-initial-base-price-review-revision-local-20260827, at: 2026-08-27T11:01:10.027Z }
status: stable
stale_after: 2026-09-26T11:01:10.027Z
sources:
  - id: official-pricing
    resource: https://partner.steamgames.com/doc/store/pricing?l=english
    title: Steamworks Pricing
    author: organization:valve
  - id: official-currencies
    resource: https://partner.steamgames.com/doc/store/pricing/currencies?l=english
    title: Steamworks Supported Currencies
    author: organization:valve
  - id: official-csv
    resource: https://partner.steamgames.com/doc/store/pricing/csv?l=english
    title: Steamworks Package Pricing CSV Import/Export
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/initial-base-price-review-revision/report.json
    title: Steam initial base-price local verification
    author: probe:steam-initial-base-price-review-revision-local
---

# Steam 初始基础价格 Revision 准备器

对外只暴露“准备首次基础价格待审 Revision”。调用方提交完整 41-market 价格表和带来源的当前状态；工具检查覆盖、最小货币单位步进、观察到的最低值、首次定价状态和稳定 mutation binding。

结果不认证 Steamworks 中的包、货币目录、最低阈值、权限或价格有效性；不生成/上传 CSV，不提交 Valve 审核，不发布价格，也不处理折扣和后续调价。

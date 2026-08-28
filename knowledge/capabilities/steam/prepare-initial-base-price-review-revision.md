---
type: Capability
title: 准备 Steam 初始基础价格审阅 Revision
description: 将未发布自有游戏的标准基础包、完整区域基础价格、观察到的最低阈值和商业证据冻结成内容寻址且待人审的 Revision。
tags: [steam, game-publishing, pricing, regional-pricing, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-initial-base-price-revision, at: 2026-08-27T11:01:10.027Z }
verified:
  - { by: probe:steam-initial-base-price-review-revision-local-20260827, at: 2026-08-27T11:01:10.027Z }
status: stable
stale_after: 2026-09-26T11:01:10.027Z
sources:
  - id: subject
    resource: ../../tools/steam-initial-base-price-revision.md
    title: Steam 初始基础价格 Revision 准备器
    author: tool:steam-initial-base-price-revision
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
  - id: official-discounts
    resource: https://partner.steamgames.com/doc/marketing/discounts?l=english
    title: Steamworks Discounting
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/initial-base-price-review-revision/report.json
    title: Steam initial base-price review revision local verification
    author: probe:steam-initial-base-price-review-revision-local
capability:
  id: steam.prepare-initial-base-price-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-initial-base-price-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-initial-base-price-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-initial-base-price-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/initial-base-price-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入只含 opaque game/package/build/source/evidence refs、调用方观察到的首次定价状态，以及金额使用最小货币单位表示的完整价格表。Connector 不登录 Steamworks、不认证目录、最低阈值、目标包、收款方或权限；结果固定 platformStateAuthenticated=false、priceValidityConfirmed=false、csvGenerated=false、submittedToValve=false、approvedByValve=false、publishedToSteam=false、discountConfigured=false、executionAuthorized=false。真实预览、提交、Valve 审核与发布必须由独立能力完成。
verification:
  level: local
  report: /verifications/steam/initial-base-price-review-revision/report.json
---

# 准备 Steam 初始基础价格审阅 Revision

这项能力只处理未发布付费游戏的标准基础包首次定价。它要求一份完整价格表：Steam 当前公开文档所列 37 个 live currencies，加 `USD_CIS`、`USD_LATAM`、`USD_MENA`、`USD_SASIA` 四个区域组。缺少任一市场会被阻断，因为 Steam 明确说明缺少某币种价格会令依赖该币种的用户无法购买。

所有金额和调用方观察到的最低基础价格都使用最小货币单位。Connector 执行当前公开的整数步进规则，例如 CLP/COP/IDR/INR/JPY 等为 100、KRW 为 1000、CRC 为 500、VND 为 50000；低于调用方观察最低值或不满足步进会阻断。但公开最低值页面需要 Steamworks 交互环境，因此本地结果固定 `minimumThresholdsAuthenticated=false`，必须在真实后台逐项复核，不能把 fixture 阈值当成 Valve 当前阈值。

预检还要求目标未发布、标准包已存在、观察不超过 24 小时、首次价格尚未提交且没有既有 price schedule 或冲突中的折扣。Revision 绑定 build、package、官方语义 revision、currency catalog、minimum threshold observation、全部价格、市场研究、当前 build 价值证据和两种审核后发布模式。准备时间不进入 hash。

即使结构通过，目标所有权、收款 Partner、`Manage pricing and discounts` 权限、真实目录/阈值、每个区域的商业判断、Steamworks preview 中的小数与异常值以及 Valve 审核仍全部待人工确认。本能力不包含 Launch Discount、后续调价、DLC、bundle、订阅或微交易，也不生成 CSV、不提交或发布价格。

- [输入 Schema](../../schemas/steam/prepare-initial-base-price-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-initial-base-price-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/initial-base-price-review-revision/report.json)

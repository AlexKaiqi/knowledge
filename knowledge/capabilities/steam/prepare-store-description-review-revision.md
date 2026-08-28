---
type: Capability
title: 准备 Steam 商店描述审阅 Revision
description: 将自有游戏的本地化纯文本短描述和 About This Game 文案冻结为确定性待审 Revision，不触达 Steamworks 或执行平台写入。
tags: [steam, game-publishing, store-description, localization, revision, local]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-store-description-revision, at: 2026-08-27T04:04:00Z }
verified:
  - { by: probe:steam-store-description-review-revision-local-20260827, at: 2026-08-27T04:04:00Z }
status: stable
stale_after: 2026-09-26T04:04:00Z
sources:
  - id: subject
    resource: ../../tools/steam-store-description-revision.md
    title: Steam 商店描述 Revision 准备器
    author: tool:steam-store-description-revision
  - id: written-description
    resource: https://partner.steamgames.com/doc/store/page/description?l=english&language=english
    title: Store Page Written Description
    author: organization:valve
  - id: localization-languages
    resource: https://partner.steamgames.com/doc/store/localization/languages?l=english&language=english
    title: Languages Supported on Steam
    author: organization:valve
  - id: review-process
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Review Process
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/store-description-review-revision/report.json
    title: Local verification report
    author: probe:steam-store-description-review-revision-local
capability:
  id: steam.prepare-store-description-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-store-description-revision.md
  kind: operation
  effect: none
  inputSchema: /schemas/steam/prepare-store-description-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-store-description-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/store-description-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只处理调用者提供的自有商店文案与 opaque evidence refs；不登录 Steam、不读取 Partner 后台、不上传/保存/发布页面、不点击 Mark as ready for review，也不把机器预检解释为内容或权利批准。
verification:
  level: local
  report: /verifications/steam/store-description-review-revision/report.json
---

# 准备 Steam 商店描述审阅 Revision

输入游戏引用、源 revision、至少一个 localization、首发功能依据和权利依据。每个 localization 包含 Steam language code、单行纯文本短描述、纯文本 `About This Game` 及 translation basis。English 必须存在，因为 Steam 官方把它定义为 fallback content；当前首版只接受官方 full-platform language code，不尝试把 game-support-only language 冒充可本地化 Store UI language。

官方要求短描述为几百字符内的 plain text、避免时间敏感文案；描述中不得放外部链接，Valve 审核还会检查描述是否详细连贯，以及页面列出的功能是否真的在首发版本可用。[官方描述规则](https://partner.steamgames.com/doc/store/page/description?l=english&language=english)与[审核流程](https://partner.steamgames.com/doc/store/review_process?l=english&language=english)因此被拆成两层：明显格式/链接/缺 fallback/本地预算由机器阻断，价值主张、时效语义、连贯性、首发一致、隐含链接、翻译与权利固定等待人工判断。

当前 probe 实际读取三份 Steam 官方页面，并用英中两份自有 fixture 验证稳定重放、byte-level 文案摘要和 mutation invalidation；同时验证无 English、未知 language、BBCode、URL 和预算超限会阻断。它没有证明真实商店页能被保存、预览、送审或批准，也没有覆盖图片、系统要求、标签、分级、Early Access 或价格。

- [输入 Schema](../../schemas/steam/prepare-store-description-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-store-description-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/store-description-review-revision/report.json)

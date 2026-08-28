---
type: Tool
title: Steam 商店描述 Revision 准备器
description: 冻结自有游戏的本地化纯文本短描述与 About This Game 文案，执行确定性预检并生成待人工审阅 Revision。
tags: [steam, game-publishing, store-description, localization, revision, preflight]
generated: { by: connector:steam-store-description-revision, at: 2026-08-27T04:04:00Z }
verified:
  - { by: probe:steam-store-description-review-revision-local-20260827, at: 2026-08-27T04:04:00Z }
status: stable
stale_after: 2026-09-26T04:04:00Z
sources:
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
  - id: local-verification
    resource: ../verifications/steam/store-description-review-revision/report.json
    title: Steam store description revision local verification
    author: probe:steam-store-description-review-revision-local
---

# Steam 商店描述 Revision 准备器

这个工具只处理自有游戏的 Steam 商店文字准备：每个 localization 的 plain-text 短描述、plain-text `About This Game`、翻译依据，以及共同的首发功能和权利依据。它不登录 Steamworks，也不处理图片、trailer、系统要求、功能标签、分级问卷、Early Access 声明、价格、上传、送审或发布。

机器检查 English fallback、当前全平台 Steam language code、短描述单行纯文本、明显链接/HTML/BBCode、NFC 和本地长度预算。它不能判断卖点是否清楚、时间语义是否会过期、描述是否连贯、首发功能是否真实、隐含链接/竞品广告、翻译准确性或权利，因此这些始终是待人工审阅项。

- [准备 Steam 商店描述审阅 Revision](../capabilities/steam/prepare-store-description-review-revision.md)
- [Steam 商店描述审阅 Revision](../concepts/steam/store-description-review-revision.md)

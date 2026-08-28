---
type: Tool
title: Steam 商店图像 Revision 准备器
description: 对本地 Steam 商店 capsule 与截图集做尺寸、数量、边界和文件摘要预检，冻结待人工视觉审阅的不可变 revision；不上传、不送审、不发布。
tags: [steam, game, store-assets, capsules, screenshots, release-preflight, human-review]
generated: { by: connector:steam-store-asset-revision, at: 2026-08-27T03:28:39Z }
verified:
  - { by: probe:steam-store-asset-review-revision-local-20260827, at: 2026-08-27T03:28:39Z }
status: stable
stale_after: 2026-09-26T03:28:39Z
sources:
  - id: asset-overview
    resource: https://partner.steamgames.com/doc/store/assets?l=english&language=english
    title: Graphical Assets - Overview
    author: organization:valve
  - id: store-assets
    resource: https://partner.steamgames.com/doc/store/assets/standard?l=english&language=english
    title: Store Graphical Assets
    author: organization:valve
  - id: graphical-rules
    resource: https://partner.steamgames.com/doc/store/assets/rules?l=english&language=english
    title: Graphical Asset Rules
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/store-asset-review-revision/report.json
    title: Steam store asset review revision verification
    author: probe:steam-store-asset-review-revision-local
---

# Steam 商店图像 Revision 准备器

这个本地工具专门处理 Steam 当前商店页图像要求，不试图把不同商店压成统一 schema。它接收一个 workspace-relative 目录、游戏与源码引用、权利依据，以及明确分类的四种 base capsule 和截图文件。

准备器校验 Header `920×430`、Small `462×174`、Main `1232×706`、Vertical `748×896`，并要求至少五张不低于 `1920×1080` 的 16:9 截图。它只接受并解析 PNG/JPEG 文件头，阻断越界路径、symlink、特殊文件、疑似凭据文件名、重复或缺失的必需种类、字节完全相同的重复截图和预算超限；每个文件均以流式 SHA-256 冻结。

机器不能仅从像素尺寸证明 logo 可读、base capsule 没有额外营销文字、图像符合 PG-13、截图确为实际 gameplay、素材权利成立或所示功能已在首发版本实现。因此 `status=ready-for-human-review` 仍固定包含六项 `pending` 人工检查；它不是 ready-to-upload，更不是 Steam 审核通过。

结果中的 `uploaded`、`markedReadyForReview`、`released` 和 `executionAuthorized` 永远为 `false`。该能力不需要 Steam Partner 账号，因为它完全不访问 Partner 后台。

- [准备 Steam 商店图像审阅 Revision](../capabilities/steam/prepare-store-asset-review-revision.md)
- [Steam Store Asset Review Revision](../concepts/steam/store-asset-review-revision.md)

---
type: Tool
title: Steam 商店 Tag Revision 准备器
description: 对有序 Steam Tag、首发证据与目录版本做结构预检并生成稳定待审 revision，不执行任何 Steamworks 操作。
tags: [steam, tags, game-publishing, discovery, revision, deterministic]
generated: { by: connector:steam-store-tag-revision, at: 2026-08-27T06:12:59Z }
verified:
  - { by: probe:steam-store-tag-review-revision-local-20260827, at: 2026-08-27T06:12:59Z }
status: stable
stale_after: 2026-09-26T06:12:59Z
sources:
  - id: official-tags
    resource: https://partner.steamgames.com/doc/store/tags?l=english&language=english
    title: Steam Tags
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/store-tag-review-revision/report.json
    title: Steam store tag revision local verification
    author: probe:steam-store-tag-review-revision-local
---

# Steam 商店 Tag Revision 准备器

工具只准备可审阅事实：5–20 个 Tag 的精确顺序、名称、稳定引用、逐项首发证据、整体 audience evidence 和目录版本。输出的 `revisionHash` 不受准备时间影响，但任一实际内容变化都会失效。

当前 Tag 是否仍存在、top five 是否清晰、排序是否符合目标受众、是否与首发 build 一致以及调用者是否拥有目标 App 权限都保留为人工审阅项。平台保存、发布、送审与上线字段固定为 false。

- [能力](../capabilities/steam/prepare-store-tag-review-revision.md)
- [Revision 概念](../concepts/steam/store-tag-review-revision.md)

---
type: Tool
title: Steam 初始上线日期 Revision 准备器
description: 冻结精确拟定上线日、玩家显示精度、Coming Soon 与审核证据，生成待人审且不产生平台副作用的 Revision。
tags: [steam, release-date, coming-soon, game-publishing, preflight]
generated: { by: connector:steam-initial-release-date-revision, at: 2026-08-27T10:28:57.632Z }
verified:
  - { by: probe:steam-initial-release-date-review-revision-local-20260827, at: 2026-08-27T10:28:57.632Z }
status: stable
stale_after: 2026-09-26T10:28:57.632Z
sources:
  - id: official-release-dates
    resource: https://partner.steamgames.com/doc/store/release_dates?language=english
    title: Steamworks Release Dates
    author: organization:valve
  - id: official-coming-soon
    resource: https://partner.steamgames.com/doc/store/coming_soon?language=english
    title: Steamworks Coming Soon
    author: organization:valve
  - id: official-release-process
    resource: https://partner.steamgames.com/doc/store/releasing?language=english
    title: Steamworks Release Process
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/initial-release-date-review-revision/report.json
    title: Steam initial release-date local verification
    author: probe:steam-initial-release-date-review-revision-local
---

# Steam 初始上线日期 Revision 准备器

对外只暴露“准备初始上线日期待审 Revision”。输入中的 Steam 当前状态是带证据引用的调用方观察，不是已经认证的平台事实。输出保留精确后台日期与玩家侧显示精度的差异，并明确列出 Coming Soon、审核状态和日期锁定 blocker。

结果永远不保存 Steamworks、不改变 Coming Soon、不点击 Release App、不触发愿望单通知，也不授予执行权限。

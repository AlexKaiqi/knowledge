---
type: Tool
title: Steam 系统要求 Revision 准备器
description: 按目标 OS 将系统要求原文与 build、depot、package、启动测试和配置证据冻结为待审 revision，不执行 Steamworks 操作。
tags: [steam, game-publishing, system-requirements, platforms, release-preflight, human-review]
generated: { by: connector:steam-system-requirements-revision, at: 2026-08-27T07:02:24Z }
verified:
  - { by: probe:steam-system-requirements-review-revision-local-20260827, at: 2026-08-27T07:02:24Z }
status: stable
stale_after: 2026-09-26T07:02:24Z
sources:
  - id: official-platforms
    resource: https://partner.steamgames.com/doc/store/application/platforms?l=english&language=english
    title: Steamworks Platforms
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/system-requirements-review-revision/report.json
    title: Steam system requirements review revision local verification
    author: probe:steam-system-requirements-review-revision-local
---

# Steam 系统要求 Revision 准备器

工具保留 Windows、macOS、Linux/SteamOS 各自的原始要求，不把不同平台伪装成一套通用硬件值。每个平台都必须绑定 build artifact、depot、public package、启动测试和逐字段 evidence；任一事实改变都会使 revision hash 改变。

本地预检要求最低配置至少包含 OS、处理器、内存、显卡和存储。推荐配置可以不提供，但一旦提供就必须完整；DirectX 只允许出现在 Windows。实际最低可运行配置、推荐性能目标、OS 版本时效以及商店页与构建的一致性仍由人审。

保存、预览、发布、送审、上线和执行授权字段固定为 false。

- [能力](../capabilities/steam/prepare-system-requirements-review-revision.md)
- [Revision 概念](../concepts/steam/system-requirements-review-revision.md)

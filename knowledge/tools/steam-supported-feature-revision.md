---
type: Tool
title: Steam 支持功能 Revision 准备器
description: 将当前 build 已实现、带实现与测试证据的 Steam 商店支持功能声明冻结为待人审 revision，不执行 Steamworks 操作。
tags: [steam, game-publishing, supported-features, build-evidence, review-revision, deterministic]
generated: { by: connector:steam-supported-feature-revision, at: 2026-08-27T08:36:24.826Z }
verified:
  - { by: probe:steam-supported-feature-review-revision-local-20260827, at: 2026-08-27T08:36:24.826Z }
status: stable
stale_after: 2026-09-26T08:36:24.826Z
sources:
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/supported-feature-review-revision/report.json
    title: Steam supported-feature review revision local verification
    author: probe:steam-supported-feature-review-revision-local
---

# Steam 支持功能 Revision 准备器

工具处理 Steam Store Page Basic Info 中拟选择的支持功能声明。每项功能必须绑定当前 build 的实现证据和测试证据，并明确标记为 `implemented-current-build`；`planned-not-released` 和 `unknown` 会直接阻断，不能包装成待发布功能。

相同输入跨时间得到相同 revision hash。Build、观察到的 feature catalog revision、功能 identity/名称、实现证据或测试证据变化都会使旧 revision 失效。

工具不读取 Steam 私有目录，也不能离线证明功能名称仍在当前后台、证据真实、功能体验完整或 build 已上传。所有这些问题继续是 pending human review；保存、预览、发布、送审和上线均不在能力内。

- [能力](../capabilities/steam/prepare-supported-feature-review-revision.md)
- [Supported Feature Review Revision](../concepts/steam/supported-feature-review-revision.md)

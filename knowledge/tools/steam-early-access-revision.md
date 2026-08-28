---
type: Tool
title: Steam Early Access Revision 准备器
description: 将六项 Early Access Q&A 与当前 build、资格、价格和披露证据冻结为待人审 revision，不执行 Steamworks 操作。
tags: [steam, early-access, questionnaire, playable-build, pricing, community, deterministic]
generated: { by: connector:steam-early-access-revision, at: 2026-08-27T09:08:48.192Z }
verified:
  - { by: probe:steam-early-access-review-revision-local-20260827, at: 2026-08-27T09:08:48.192Z }
status: stable
stale_after: 2026-09-26T09:08:48.192Z
sources:
  - id: official-early-access
    resource: https://partner.steamgames.com/doc/store/earlyaccess?language=english
    title: Steam Early Access
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/early-access-review-revision/report.json
    title: Steam Early Access review revision local verification
    author: probe:steam-early-access-review-revision-local
---

# Steam Early Access Revision 准备器

工具处理 Early Access 商店页的六项 Q&A，并把答卷与一个精确当前 build 绑定。调用者必须声明 build 已可玩、开发尚未完成、项目不依赖预期销量才能完成、未来计划可变、社区能够实质影响开发，以及 Steam 售价不高于其它服务。

当前功能、已知限制、gameplay trailer、价格透明度、跨服务价格和第三方 key 站点的 Early Access branding/current-state/Q&A 披露均使用 evidence refs 绑定。相同输入跨时间得到相同 revision hash；任何答卷、build、状态、价格或披露变化都会使旧 revision 失效或阻断。

工具不判断文案是否诚实，不验证实际 build、价格或销售站点，也不操作 Steamworks。平台保存、发布、送审、Early Access 上线和执行授权固定为 false。

- [能力](../capabilities/steam/prepare-early-access-review-revision.md)
- [Early Access Review Revision](../concepts/steam/early-access-review-revision.md)

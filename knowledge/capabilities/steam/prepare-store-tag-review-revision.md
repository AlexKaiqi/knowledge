---
type: Capability
title: 准备 Steam 商店 Tag 审阅 Revision
description: 将有序、带首发证据和目录版本的 5–20 个 Steam Tag 冻结为内容寻址、待人审且不授权平台写入的 Revision。
tags: [steam, game-publishing, store-page, tags, discovery, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-store-tag-revision, at: 2026-08-27T06:12:59Z }
verified:
  - { by: probe:steam-store-tag-review-revision-local-20260827, at: 2026-08-27T06:12:59Z }
status: stable
stale_after: 2026-09-26T06:12:59Z
sources:
  - id: subject
    resource: ../../tools/steam-store-tag-revision.md
    title: Steam 商店 Tag Revision 准备器
    author: tool:steam-store-tag-revision
  - id: official-tags
    resource: https://partner.steamgames.com/doc/store/tags?l=english&language=english
    title: Steam Tags
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/store-tag-review-revision/report.json
    title: Steam store tag review revision local verification
    author: probe:steam-store-tag-review-revision-local
capability:
  id: steam.prepare-store-tag-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-store-tag-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-store-tag-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-store-tag-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/store-tag-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只含 opaque game/source/catalog/evidence refs 与有序 Tag 名称。结果固定 platformValidated=false、savedToSteamworks=false、published=false、markedReadyForReview=false、released=false、executionAuthorized=false；真实目录有效性、相关性、构建一致性、保存、发布、送审和上线必须由拥有目标 App 权限的人另行完成。
verification:
  level: local
  report: /verifications/steam/store-tag-review-revision/report.json
---

# 准备 Steam 商店 Tag 审阅 Revision

官方规则要求游戏发布前至少设置 5 个 Tag，并建议最多 20 个；排序会影响 Tag 浏览、搜索、推荐和相似游戏，前 5 个尤其应清楚描述游戏。输入因此保留调用方的精确顺序，并要求每个 Tag 绑定首发证据，整体再绑定 audience evidence 与观察到的目录 revision。

结构预检只证明数量、唯一性、证据引用和有序 top five 完整。它不能离线证明某个显示名称仍存在于 Steam Tag Wizard，也不能判断 Tag 是否准确、具体或与真实 build 一致；这些都固定为 pending human review。任一顺序、Tag identity、显示名称、证据或目录 revision 变化都会生成不同 hash。

该能力不登录 Steamworks、不读取私有 App、不保存 Tag、不发布页面、不送审、不上线，也不声称提高曝光。真实平台写入与影响力观察属于后续独立能力。

- [输入 Schema](../../schemas/steam/prepare-store-tag-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-store-tag-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/store-tag-review-revision/report.json)

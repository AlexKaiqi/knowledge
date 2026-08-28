---
type: Capability
title: 准备 Steam 初始上线日期审阅 Revision
description: 将精确拟定上线日、玩家侧显示精度、Coming Soon 时长、store/build revision 与当前审核状态冻结成内容寻址且待人审的 Revision。
tags: [steam, game-publishing, release-date, coming-soon, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-initial-release-date-revision, at: 2026-08-27T10:28:57.632Z }
verified:
  - { by: probe:steam-initial-release-date-review-revision-local-20260827, at: 2026-08-27T10:28:57.632Z }
status: stable
stale_after: 2026-09-26T10:28:57.632Z
sources:
  - id: subject
    resource: ../../tools/steam-initial-release-date-revision.md
    title: Steam 初始上线日期 Revision 准备器
    author: tool:steam-initial-release-date-revision
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
  - id: local-report
    resource: ../../verifications/steam/initial-release-date-review-revision/report.json
    title: Steam initial release-date review revision local verification
    author: probe:steam-initial-release-date-review-revision-local
capability:
  id: steam.prepare-initial-release-date-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-initial-release-date-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-initial-release-date-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-initial-release-date-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/initial-release-date-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只含 opaque game/source/store/build/evidence refs、调用方观察到的 release state、拟定日期与显示精度。观察状态不会被认证，结果固定 platformStateAuthenticated=false、savedToSteamworks=false、comingSoonChanged=false、releaseButtonPressed=false、released=false、wishlistNotificationsTriggered=false、executionAuthorized=false；真实登录、权限核验、保存、Coming Soon 发布、审核、Release App 点击与愿望单通知必须在独立能力中完成。
verification:
  level: local
  report: /verifications/steam/initial-release-date-review-revision/report.json
---

# 准备 Steam 初始上线日期审阅 Revision

Steam 的“上线日期”不是一段显示文案。后台必须保存一个精确拟定日期；玩家侧则可以显示精确日、月和年、季度、年份或只显示 Coming Soon。除精确日外，Steam 会按可见时间范围的最后一天放入 Upcoming 排序；只显示 Coming Soon 时排在所有带日期的游戏之后。本能力保留精确日期，同时派生显示范围与排序日期，不生成或冻结 Steam 的本地化文案。

预检要求目标仍未上线、观察不超过 24 小时、目标日期在未来、Coming Soon 到目标日期至少 14 天、商店页与 build 的调用方观察状态均为 Ready for release。若拟定日期已经进入两周锁定窗口，修改精确日期会被阻断；保持现有日期、只改变玩家显示精度不会被误判为修改后台日期。24 小时观察新鲜度是本仓库的保守策略，不是 Valve 公布的 SLA。

即使预检通过，来源语义、目标所有权、两项 Steamworks 权限、审核状态、公开传播一致性、上线日支持计划和愿望单通知影响仍全部待人工确认。该能力不登录 Steamworks，也不认证调用方提交的状态；它只准备可审阅 Revision，不能冒充已经排期或已经发布。

- [输入 Schema](../../schemas/steam/prepare-initial-release-date-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-initial-release-date-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/initial-release-date-review-revision/report.json)

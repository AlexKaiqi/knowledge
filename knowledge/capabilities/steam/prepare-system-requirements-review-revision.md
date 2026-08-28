---
type: Capability
title: 准备 Steam 系统要求审阅 Revision
description: 按支持 OS 冻结系统要求与构建、分发、启动测试证据，生成内容寻址、待人审且不授权平台写入的 Revision。
tags: [steam, game-publishing, system-requirements, platforms, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-system-requirements-revision, at: 2026-08-27T07:02:24Z }
verified:
  - { by: probe:steam-system-requirements-review-revision-local-20260827, at: 2026-08-27T07:02:24Z }
status: stable
stale_after: 2026-09-26T07:02:24Z
sources:
  - id: subject
    resource: ../../tools/steam-system-requirements-revision.md
    title: Steam 系统要求 Revision 准备器
    author: tool:steam-system-requirements-revision
  - id: official-platforms
    resource: https://partner.steamgames.com/doc/store/application/platforms?l=english&language=english
    title: Steamworks Platforms
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: first-party-example
    resource: https://store.steampowered.com/app/620/Portal_2/?l=english
    title: Portal 2 on Steam
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/system-requirements-review-revision/report.json
    title: Steam system requirements review revision local verification
    author: probe:steam-system-requirements-review-revision-local
capability:
  id: steam.prepare-system-requirements-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-system-requirements-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-system-requirements-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-system-requirements-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/system-requirements-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只含 opaque game/source/build/artifact/depot/package/test/evidence refs 与调用方拥有的系统要求原文。结果固定 savedToSteamworks=false、previewedOnSteam=false、published=false、markedReadyForReview=false、released=false、executionAuthorized=false；真实测试、后台配置、保存、预览、发布、送审与上线必须由拥有目标 App 权限的人另行完成。
verification:
  level: local
  report: /verifications/steam/system-requirements-review-revision/report.json
---

# 准备 Steam 系统要求审阅 Revision

Steam 官方把增加支持平台定义为一条相互约束的链：为 OS 创建 depot、构建并在 beta branch 测试、把 depot 加入 public packages、勾选商店支持 OS、填写对应系统要求、预览发布，最后再移动默认 build。审核还要求产品能在商店列出的每个支持 OS 启动。因此本能力拒绝只收一段无构建证据的通用文案。

输入按平台保留 minimum 和可选 recommended 字段。最低配置的 OS、处理器、内存、显卡、存储必须齐全；推荐配置若非空也必须齐全；非 Windows 平台不能声明 DirectX。这里的核心字段完整性是本仓库的保守预检策略，不冒充 Valve 对每个字段的硬性判定。

结构通过后仍必须人工确认配置真能运行、性能目标合理、证据与 build 匹配、平台状态一致、OS 版本仍受支持。该能力不登录 Steamworks、不读取私有 App、不编辑 depot/package/checkbox、不保存、不预览、不发布、不送审、不上线。

- [输入 Schema](../../schemas/steam/prepare-system-requirements-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-system-requirements-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/system-requirements-review-revision/report.json)

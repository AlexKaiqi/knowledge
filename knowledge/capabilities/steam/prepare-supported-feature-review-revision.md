---
type: Capability
title: 准备 Steam 支持功能审阅 Revision
description: 将当前 build 已实现、带实现与测试证据的 Steam 商店支持功能声明冻结为确定性待人审 Revision。
tags: [steam, game-publishing, store-page, supported-features, build-consistency, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-supported-feature-revision, at: 2026-08-27T08:36:24.826Z }
verified:
  - { by: probe:steam-supported-feature-review-revision-local-20260827, at: 2026-08-27T08:36:24.826Z }
status: stable
stale_after: 2026-09-26T08:36:24.826Z
sources:
  - id: subject
    resource: ../../tools/steam-supported-feature-revision.md
    title: Steam 支持功能 Revision 准备器
    author: tool:steam-supported-feature-revision
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: official-page
    resource: https://partner.steamgames.com/doc/store/page?l=english&language=english
    title: Steam Store Page Building and Editing
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/supported-feature-review-revision/report.json
    title: Steam supported-feature review revision local verification
    author: probe:steam-supported-feature-review-revision-local
capability:
  id: steam.prepare-supported-feature-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-supported-feature-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-supported-feature-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-supported-feature-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/supported-feature-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只含 opaque game/source/build/catalog/evidence refs 和调用方拟声明的功能名称。结果不证明当前 Steam 后台目录、真实 build 或测试，不保存、预览、发布、送审、上线或授权执行；这些动作必须由拥有目标 App 权限的人另行完成。
verification:
  level: local
  report: /verifications/steam/supported-feature-review-revision/report.json
---

# 准备 Steam 支持功能审阅 Revision

官方 review guidance 要求商店页列出的支持功能已经在当前 build 实现；未来功能在实现并发布前应从 Basic Info 取消选择。本能力因此把 `sourceRevisionRef + buildRevisionRef + featureCatalogRevisionRef` 与逐功能实现/测试证据冻结在一起。

本地 fixture 包含五项拟声明功能并验证稳定重放。Build、目录、名称、实现证据或测试证据任一变化都会生成不同 hash；planned、unknown、重复 ref 和重复名称会被阻断。结构通过后，目录映射、证据质量、当前 public build 和真实可用性仍全部 pending。

能力不登录 Steamworks、不读取私有 App、不把 fixture 名称冒充当前 Steam 目录，也不保存、预览、发布、送审或上线。它只准备 exact review revision，不能替代平台验证或人工批准。

- [输入 Schema](../../schemas/steam/prepare-supported-feature-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-supported-feature-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/supported-feature-review-revision/report.json)

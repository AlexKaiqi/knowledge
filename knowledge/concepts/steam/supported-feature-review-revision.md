---
type: Concept
title: Steam Supported Feature Review Revision
description: 将自有游戏、当前 build、观察到的功能目录和逐功能实现/测试证据绑定为内容寻址、待人审且不可执行的商店声明 revision。
tags: [steam, supported-features, build-consistency, evidence, review-revision]
generated: { by: connector:steam-supported-feature-revision, at: 2026-08-27T08:36:24.826Z }
verified:
  - { by: probe:steam-supported-feature-review-revision-local-20260827, at: 2026-08-27T08:36:24.826Z }
status: stable
stale_after: 2026-09-26T08:36:24.826Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/supported-feature-review-revision/snapshot.json
    title: Verified current-build supported-feature revision fixture
    author: connector:steam-supported-feature-revision
---

# Steam Supported Feature Review Revision

Revision 的 identity 包含游戏、设计源 revision、当前 build revision、观察到的 Steam feature catalog revision，以及按 feature ref 排序的全部功能声明、实现证据和测试证据。`preparedAt` 不参与 identity。

只有 `implemented-current-build` 能进入 ready revision。未来计划和实现未知不是审阅提示，而是结构 blocker，因为 Steam 的 review boundary 要求商店所列支持功能已存在于当前 build。通过结构检查也不代表 Valve 已验证 build，或某功能的实际体验符合商店含义。

输出固定要求人工审阅，并固定 `platformValidated=false`、`buildValidatedByConnector=false`、`savedToSteamworks=false`、`previewedOnSteam=false`、`published=false`、`markedReadyForReview=false`、`released=false`、`executionAuthorized=false`。

- [输出 Schema](../../schemas/steam/prepare-supported-feature-review-revision-output.schema.json)
- [验证快照](../../verifications/steam/supported-feature-review-revision/snapshot.json)

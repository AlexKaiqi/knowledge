---
type: Concept
title: Steam 商店描述审阅 Revision
description: 将本地化商店文案、翻译依据、首发功能依据、权利依据和当前规则绑定成不可变摘要的人工审阅对象。
tags: [steam, store-description, localization, immutable-revision, human-review]
generated: { by: connector:steam-store-description-revision, at: 2026-08-27T04:04:00Z }
verified:
  - { by: probe:steam-store-description-review-revision-local-20260827, at: 2026-08-27T04:04:00Z }
status: stable
stale_after: 2026-09-26T04:04:00Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/store-description-review-revision/snapshot.json
    title: Verified Steam store description review revision
    author: connector:steam-store-description-revision
---

# Steam 商店描述审阅 Revision

Revision 的 identity 由游戏引用、源 revision、按 language 排序的完整文案、逐文案摘要、translation basis、launch feature refs、rights basis refs 和规则 revision 共同决定。`preparedAt` 不参与 identity；相同内容跨时间重放得到相同 hash，任何文案或依据变化都必须重新审阅。

`ready-for-human-review` 只表示结构和确定性规则通过。它不是“Steam metadata 已完成”，更不是上传、发布、Valve 审核或批准。输出中的七项语义审阅都固定为 `pending`，且 `uploaded/published/markedReadyForReview/released/executionAuthorized` 永远为 `false`。

- [输出 Schema](../../schemas/steam/prepare-store-description-review-revision-output.schema.json)
- [验证样本](../../verifications/steam/store-description-review-revision/snapshot.json)

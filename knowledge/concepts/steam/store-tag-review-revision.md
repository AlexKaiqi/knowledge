---
type: Concept
title: Steam Store Tag Review Revision
description: 内容寻址的有序 Steam Tag 候选，绑定来源、目录、受众与首发证据，等待平台有效性和语义相关性人审。
tags: [steam, tags, store-discovery, revision, human-review]
generated: { by: connector:steam-store-tag-revision, at: 2026-08-27T06:12:59Z }
verified:
  - { by: probe:steam-store-tag-review-revision-local-20260827, at: 2026-08-27T06:12:59Z }
status: stable
stale_after: 2026-09-26T06:12:59Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/store-tag-review-revision/snapshot.json
    title: Verified Steam store tag review revision
    author: connector:steam-store-tag-revision
---

# Steam Store Tag Review Revision

Revision 中 `rank` 从 1 开始，`topFive=true` 只标记前 5 项的重要位置，不代表质量已经通过。`catalogRevisionRef` 说明候选依据哪个 Tag 目录观察生成；它不是平台签名，也不能代替登录后的 Tag Wizard 确认。

`launchEvidenceRefs` 使每个 Tag 都能回到首发产品事实，但只证明调用方提供了引用。人工仍需核对引用、实际 build、Tag 当前有效性、相关性、具体性、top five 清晰度和排序意图。

所有平台状态字段固定为 false。准备 Revision 不等于保存、发布、送审、通过审核、上线或获得可见性。

- [输出 Schema](../../schemas/steam/prepare-store-tag-review-revision-output.schema.json)
- [验证快照](../../verifications/steam/store-tag-review-revision/snapshot.json)

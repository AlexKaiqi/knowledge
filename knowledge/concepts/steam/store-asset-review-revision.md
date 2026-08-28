---
type: Concept
title: Steam Store Asset Review Revision
description: 由 Steam 商店 capsule、截图文件摘要、结构预检结果、源码引用与权利依据组成的待人工视觉审阅对象；不是上传、送审或发布回执。
tags: [steam, store-assets, revision, capsule, screenshot, human-review, non-upload]
generated: { by: connector:steam-store-asset-revision, at: 2026-08-27T03:28:39Z }
verified:
  - { by: probe:steam-store-asset-review-revision-local-20260827, at: 2026-08-27T03:28:39Z }
status: stable
stale_after: 2026-09-26T03:28:39Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/store-asset-review-revision/snapshot.json
    title: Verified Steam store asset review revision
    author: connector:steam-store-asset-revision
---

# Steam Store Asset Review Revision

`Steam Store Asset Review Revision` 是 Steam Partner 写操作之前的本地 handoff 对象。它用稳定排序的相对路径、媒体格式、宽高、字节数和 SHA-256 标识图像文件，并把 `gameRef`、`sourceRevisionRef` 与 `rightsBasisRefs` 纳入 revision payload。

`revisionHash` 不包含 `preparedAt`，所以同一组冻结字节和声明可以重放。`status=blocked` 时不暴露部分 asset manifest，避免下游把不完整文件集误当可用；`status=ready-for-human-review` 仅证明机器可验证的尺寸、数量、边界和摘要检查通过。

六项视觉、内容、权利与首发一致性检查始终保持 `pending`，直到另一个受控的人审流程产生独立证据。该 revision 也不证明 PNG/JPEG 的完整解码渲染效果、Steam 后台实际接受文件、商店页已经送审或游戏已经发布。

- [输出 Schema](../../schemas/steam/prepare-store-asset-review-revision-output.schema.json)
- [验证样本](../../verifications/steam/store-asset-review-revision/snapshot.json)

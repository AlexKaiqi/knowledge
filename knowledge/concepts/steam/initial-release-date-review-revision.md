---
type: Concept
title: SteamInitialReleaseDateReviewRevision
description: 将初始上线的精确日期、玩家显示范围、Upcoming 排位语义、当前审核证据和保守时间预检绑定在一起的内容寻址待审对象。
tags: [steam, release-date, revision, coming-soon, human-review]
generated: { by: connector:steam-initial-release-date-revision, at: 2026-08-27T10:28:57.632Z }
verified:
  - { by: probe:steam-initial-release-date-review-revision-local-20260827, at: 2026-08-27T10:28:57.632Z }
status: stable
stale_after: 2026-09-26T10:28:57.632Z
sources:
  - id: capability
    resource: ../../capabilities/steam/prepare-initial-release-date-review-revision.md
    title: 准备 Steam 初始上线日期审阅 Revision
    author: capability:steam.prepare-initial-release-date-review-revision
  - id: verified-snapshot
    resource: ../../verifications/steam/initial-release-date-review-revision/snapshot.json
    title: Verified Steam initial release-date review revision
    author: probe:steam-initial-release-date-review-revision-local
---

# SteamInitialReleaseDateReviewRevision

该 Revision 绑定一个精确的拟定上线日，同时保留玩家侧五种显示精度及其日期范围、Upcoming 排位日期或“排在带日期项目之后”的语义。它还绑定 store/build revision、调用方观察到的审核状态、Coming Soon 日期与证据引用。

Revision hash 不包含准备时间，但任何来源、store/build、观察证据、精确日期、显示精度或决策证据变化都会失效。`ready-for-human-review` 只表示本地结构和保守时间规则通过；`platformStateAuthenticated=false` 与全部副作用 false 是对象本身的固定边界。

- [输出 Schema](../../schemas/steam/prepare-initial-release-date-review-revision-output.schema.json)
- [验证样本](../../verifications/steam/initial-release-date-review-revision/snapshot.json)

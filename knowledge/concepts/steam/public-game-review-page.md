---
type: Concept
title: Steam 公开游戏评论页
description: Steam 文档化公开评论端点针对一个 App ID 和筛选条件返回的有界 cursor page，已删除作者身份。
tags: [steam, game-review, cursor-page, player-feedback, deidentified]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T01:02:20Z }
verified:
  - { by: probe:steam-public-game-reviews-live-20260827, at: 2026-08-27T01:02:20Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: platform
    resource: ../../platforms/steam.md
    title: Steam
    author: organization:valve
  - id: live-snapshot
    resource: ../../verifications/steam/public-game-reviews/snapshot.json
    title: Redacted live review-page observation
    author: connector:steam-public-game-reviews
---

# Steam 公开游戏评论页

该概念表示一个 `cursor-page`，不是完整评论语料、稳定增量日志或玩家样本。第一页可能带 query summary；后续页可能没有。`filter=recent` 按创建时间排序，`filter=updated` 按最近更新时间排序；两者都允许沿 opaque cursor 有界遍历。`pageExhausted=true` 只说明当前遍历已返回空页，不能证明平台历史或研究样本完整。

评论身份使用 Steam 返回的 `recommendationid`，不是作者身份。输出保留评论自身的文本、语言、时间、推荐方向和有限购买/游玩情境，但删除作者 SteamID、名称、头像、主页和跨评论关联。评论可能被编辑、删除、过滤或重新排序；Collector 必须按 recommendation ID 和更新时间去重，不能把 cursor 当永久 checkpoint 或 exactly-once 保证。

默认不包含 Steam 标记的 off-topic activity。即使显式包含，评论数量与情绪也只能作为当前查询下的平台原生信号，不能单独证明总体玩家需求、根因、市场规模或因果影响。

- [输出 Schema](../../schemas/steam/read-public-game-review-page-output.schema.json)
- [脱敏验证快照](../../verifications/steam/public-game-reviews/snapshot.json)

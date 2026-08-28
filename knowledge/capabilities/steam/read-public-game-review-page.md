---
type: Capability
title: 读取 Steam 公开游戏评论页
description: 通过 Steamworks 文档化公开端点，读取一个明确游戏的有界、去作者身份评论 cursor page。
tags: [steam, games, reviews, feedback, demand-research, official-api]
outcomes: [demand-discovery, product-research, feedback-collection]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T01:02:20Z }
verified:
  - { by: probe:steam-public-game-reviews-live-20260827, at: 2026-08-27T01:02:20Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: subject
    resource: ../../platforms/steam.md
    title: Steam
    author: organization:valve
  - id: official-api
    resource: https://partner.steamgames.com/doc/store/getreviews
    title: User Reviews - Get List
    author: organization:valve
  - id: live-report
    resource: ../../verifications/steam/public-game-reviews/report.json
    title: Steam public game reviews live verification
    author: probe:steam-public-game-reviews-live
capability:
  id: steam.games.reviews.read-public-page
  version: 1.0.0
  subjectRef: /platforms/steam.md
  kind: query
  effect: none
  inputSchema: /schemas/steam/read-public-game-review-page-input.schema.json
  outputSchema: /schemas/steam/read-public-game-review-page-output.schema.json
  resultConcepts: [/concepts/steam/public-game-review-page.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只读取调用者明确指定 App ID 的公开评论。运行时可以瞬时返回评论正文，但默认不得持久化作者身份、原始响应或评论全文；营销引用需要另行取得评论作者许可。禁止操纵、诱导或奖励评论。
verification:
  level: live
  report: /verifications/steam/public-game-reviews/report.json
---

# 读取 Steam 公开游戏评论页

输入限定一个 Steam App ID、`recent|updated`、语言、推荐方向、购买类型、opaque cursor、是否包含 off-topic activity，以及最多 20 条的页大小。Connector 只请求官方 `GET https://store.steampowered.com/appreviews/<appid>?json=1`，固定响应预算、拒绝重定向、失败不重试。

输出保留当前 query、cursor、覆盖边界、可选首屏 summary，以及去作者身份的评论。评论正文最长返回 16,000 字符，并同时提供原文长度与 SHA-256；超过上限时明确 `truncated=true`。SteamID、名称、头像、主页、用户拥有游戏数、评论数、最近游玩和 raw payload 永不进入结果。

这项能力适合：验证游戏问题词、提取玩家表达、比较正负面反馈、观察近期编辑和为需求研究提供一手问题证据。它不提供评论主题自动结论；应把结果交给证据化调研能力，并保留来源、反证与样本边界。

已验证范围：2026-08-27 对 Portal 2（App 620）以 `updated/english/all` 读取 5 条，返回 query summary 和 cursor，更新时间降序，作者身份已删除，Git 快照中的评论文本已脱敏。未验证全量遍历、Exactly-once delta、其它语言、off-topic inclusion、评论删除/编辑的长期 reconcile 或 Partner 能力。

- [输入 Schema](../../schemas/steam/read-public-game-review-page-input.schema.json)
- [输出 Schema](../../schemas/steam/read-public-game-review-page-output.schema.json)
- [验证报告](../../verifications/steam/public-game-reviews/report.json)

---
type: Capability
title: 将 Steam 评论页投影为反馈观察窗口
description: 把已验证的 Steam 公开评论 cursor page 转换为可对账的去身份化 partial observation window，并显式声明 checkpoint 与删除推断边界。
tags: [steam, games, reviews, feedback, observation, cursor, checkpoint]
outcomes: [feedback-collection, product-research, demand-discovery]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T02:58:28Z }
verified:
  - { by: probe:steam-review-observation-projection-local-20260827, at: 2026-08-27T02:58:28Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: subject
    resource: ../../tools/steam-review-observation-projector.md
    title: Steam 评论观察投影器
    author: tool:steam-review-observation-projector
  - id: official-api
    resource: https://partner.steamgames.com/doc/store/getreviews
    title: User Reviews - Get List
    author: organization:valve
  - id: upstream-live-report
    resource: ../../verifications/steam/public-game-reviews/report.json
    title: Steam public review live verification
    author: probe:steam-public-game-reviews-live
  - id: local-report
    resource: ../../verifications/steam/review-observation-projection/report.json
    title: Steam review observation projection verification
    author: probe:steam-review-observation-projection-local
capability:
  id: steam.games.reviews.project-feedback-observation-window
  version: 1.0.0
  subjectRef: /tools/steam-review-observation-projector.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/read-public-game-review-page-output.schema.json
  outputSchema: /schemas/steam/project-review-page-to-observation-window-output.schema.json
  resultConcepts: [/concepts/steam/review-observation-window.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只消费读取能力已归一化的 Steam 评论页；不再次访问平台，不保留正文或作者身份，不推断删除、不推进 checkpoint、不回复评论。
verification:
  level: local
  report: /verifications/steam/review-observation-projection/report.json
---

# 将 Steam 评论页投影为反馈观察窗口

输入是“读取 Steam 公开游戏评论页”的规范化输出。每条评论转换成 `steam-review:<recommendationId>` 与一个覆盖正文摘要、更新时间、推荐方向和评论情境的语义摘要，因此相同推荐 ID 的内容或情境变化可以被后续对账识别为 edit。

输出可直接作为反馈观察对账能力的一个 window 使用，但完整度固定为 `partial`。即使当前页为空或 `pageExhausted=true`，它也只说明本次 cursor page，没有证明整个语料完整；所以 checkpoint recommendation 固定 `hold`，缺失不允许推断删除。

本地组合 probe 使用仍在有效期内的 Steam live 脱敏快照，验证顺序无关、摘要变更检测、对账器能标记 edit，以及正文/身份不进入输出。它没有证明跨页 exactly-once、稳定全量扫描、删除 tombstone、开发者回复或 Partner 数据。

- [输入 Schema](../../schemas/steam/read-public-game-review-page-output.schema.json)
- [输出 Schema](../../schemas/steam/project-review-page-to-observation-window-output.schema.json)
- [验证报告](../../verifications/steam/review-observation-projection/report.json)

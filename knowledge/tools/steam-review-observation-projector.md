---
type: Tool
title: Steam 评论观察投影器
description: 将已验证的 Steam 公开评论页转换为可对账、去正文和去作者身份的 partial feedback observation window。
tags: [steam, feedback, observation, projection, checkpoint, privacy]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T02:58:28Z }
verified:
  - { by: probe:steam-review-observation-projection-local-20260827, at: 2026-08-27T02:58:28Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: upstream-platform
    resource: ../platforms/steam.md
    title: Steam
    author: organization:valve
  - id: upstream-live-report
    resource: ../verifications/steam/public-game-reviews/report.json
    title: Steam public game reviews live verification
    author: probe:steam-public-game-reviews-live
  - id: local-report
    resource: ../verifications/steam/review-observation-projection/report.json
    title: Steam review observation projection verification
    author: probe:steam-review-observation-projection-local
---

# Steam 评论观察投影器

这个工具隔离 Steam 原生 cursor、recommendation ID 和评论字段，只向外暴露统一反馈观测窗口。它不访问平台，输入必须是已归一化的 Steam 评论页；输出不包含评论正文、作者身份或执行授权。

它刻意不把能力夸大成 `FeedbackDelta`：所有窗口固定 `partial`，resume cursor 不是全局 high-watermark，公开 route 没有 tombstone 或回复状态证据，checkpoint 固定 hold。

- [将 Steam 评论页投影为反馈观察窗口](../capabilities/steam/project-review-page-to-observation-window.md)
- [验证报告](../verifications/steam/review-observation-projection/report.json)

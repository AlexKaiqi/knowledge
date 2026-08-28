---
type: Concept
title: Steam Review Observation Window
description: 从 Steam 公开评论 cursor page 形成的去正文、去作者身份、固定 partial 的反馈观测窗口。
tags: [steam, feedback, observation-window, cursor, checkpoint, privacy]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T02:58:28Z }
verified:
  - { by: probe:steam-review-observation-projection-local-20260827, at: 2026-08-27T02:58:28Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: subject
    resource: ../../platforms/steam.md
    title: Steam
    author: organization:valve
  - id: upstream-live-report
    resource: ../../verifications/steam/public-game-reviews/report.json
    title: Steam public game reviews live verification
    author: probe:steam-public-game-reviews-live
  - id: local-report
    resource: ../../verifications/steam/review-observation-projection/report.json
    title: Steam review observation projection verification
    author: probe:steam-review-observation-projection-local
---

# Steam Review Observation Window

它把每条 Steam recommendation ID 映射为稳定 opaque item ref，并用评论全文摘要、更新时间、推荐方向、语言、游玩与购买情境生成语义摘要。正文、作者身份和 raw payload 不进入窗口。

窗口永远是 `partial`。`resumeCursor` 只用于继续同一查询的分页，不是全局 high-watermark；页面中缺失某条评论不能推断删除。Steam 公开端点没有在已验证范围内提供显式删除/隐藏 tombstone 或开发者回复状态，因此 lifecycle 固定 `visible`、reply state 固定 `unknown`。

- [产品 Schema](../../schemas/steam/project-review-page-to-observation-window-output.schema.json)
- [验证报告](../../verifications/steam/review-observation-projection/report.json)

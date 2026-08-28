---
type: Concept
title: Feedback Observation Reconciliation
description: 两个有界反馈观察窗口之间的可重放 mutation set、未决缺失项、计数与 checkpoint 建议。
tags: [feedback, observation-window, mutation-set, missing-unknown, checkpoint]
generated: { by: connector:feedback-observation-reconciler, at: 2026-08-27T02:35:18Z }
verified:
  - { by: probe:feedback-observation-reconciliation-local-20260827, at: 2026-08-27T02:35:18Z }
status: stable
stale_after: 2026-09-26T02:35:18Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/feedback/observation-reconciliation/snapshot.json
    title: Verified feedback observation reconciliation
    author: connector:feedback-observation-reconciler
---

# Feedback Observation Reconciliation

这个对象不是“所有反馈的当前真相”，而是两个明确 observation window 的差异证据。`changes` 对当前窗口每个 item 保留 prior/current state 和一个或多个 mutation；同一 item 可同时 `edited` 与 `reply-state-changed`。

`missingUnresolved` 明确保留上次出现、本次未观察到的 item，并固定 `deletionInferred=false`。分页、排序、时间窗、权限、审核隐藏和来源故障都可能造成缺失，所以删除只能来自显式生命周期证据。

`checkpointRecommendation` 是 proposal，不是 checkpoint commit。`resultDigest` 使相同的规范化窗口可确定性重放；它不证明上游窗口完整声明真实，也不替代平台 Connector 的分页和 tombstone 语义验证。

- [输出 Schema](../../schemas/feedback/reconcile-feedback-observations-output.schema.json)
- [验证样本](../../verifications/feedback/observation-reconciliation/snapshot.json)

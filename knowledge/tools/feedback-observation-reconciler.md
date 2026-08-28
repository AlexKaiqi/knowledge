---
type: Tool
title: 反馈观察对账器
description: 对两次已去身份化的有界反馈观察做确定性对账，区分内容编辑、回复状态和显式生命周期，并拒绝从缺失推断删除。
tags: [feedback, reconciliation, mutation, checkpoint, privacy, deterministic]
generated: { by: connector:feedback-observation-reconciler, at: 2026-08-27T02:35:18Z }
verified:
  - { by: probe:feedback-observation-reconciliation-local-20260827, at: 2026-08-27T02:35:18Z }
status: stable
stale_after: 2026-09-26T02:35:18Z
sources:
  - id: production-feedback-contract
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/spec/feedback-item.schema.json
    title: dsh-social-workbench feedback item contract
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/feedback/observation-reconciliation/report.json
    title: Feedback observation reconciliation local verification
    author: probe:feedback-observation-reconciliation-local
---

# 反馈观察对账器

这个本地工具消费两次有界观察。每个 feedback item 只提供 opaque `itemRef`、正文的语义摘要、显式 `visible|deleted|hidden` 生命周期和粗粒度回复状态；不接收正文、用户名、账号、头像、邮箱或跨平台身份。

结果区分 `new`、`edited`、`reply-state-changed`、`deleted`、`hidden`、`resurfaced`、`lifecycle-observed` 与 `unchanged`。只有来源明确返回删除/隐藏 tombstone 才能形成生命周期变化；上次出现而本次没出现的 item 一律进入 `missingUnresolved`，即使本次窗口自称 complete 也不推断删除。

完整窗口与新 checkpoint 只生成 `propose-advance` 建议，不实际推进采集器状态。这个工具不读取平台、不保存账本、不归纳主题、不回复用户，也不授权任何动作。

- [对账反馈观察](../capabilities/feedback/reconcile-feedback-observations.md)
- [Feedback Observation Reconciliation](../concepts/feedback/feedback-observation-reconciliation.md)

---
type: Capability
title: 对账反馈观察
description: 对两次已去身份化的反馈观察窗口生成可重放 mutation set，明确编辑、回复和显式删除/隐藏，同时保留缺失未知性。
tags: [feedback, reconcile, mutation, deletion, reply-state, checkpoint, privacy]
outcomes: [feedback-collection, product-research]
generated: { by: connector:feedback-observation-reconciler, at: 2026-08-27T02:35:18Z }
verified:
  - { by: probe:feedback-observation-reconciliation-local-20260827, at: 2026-08-27T02:35:18Z }
status: stable
stale_after: 2026-09-26T02:35:18Z
sources:
  - id: subject
    resource: ../../tools/feedback-observation-reconciler.md
    title: 反馈观察对账器
    author: tool:feedback-observation-reconciler
  - id: production-feedback-ledger
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/loop-control.mjs
    title: dsh-social-workbench feedback ledger
    author: organization:alex-kaiqi
  - id: local-report
    resource: ../../verifications/feedback/observation-reconciliation/report.json
    title: Local verification report
    author: probe:feedback-observation-reconciliation-local
capability:
  id: feedback.reconcile-feedback-observations
  version: 1.0.0
  subjectRef: /tools/feedback-observation-reconciler.md
  kind: computation
  effect: none
  inputSchema: /schemas/feedback/reconcile-feedback-observations-input.schema.json
  outputSchema: /schemas/feedback/reconcile-feedback-observations-output.schema.json
  resultConcepts: [/concepts/feedback/feedback-observation-reconciliation.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只接收去身份化 opaque item ref、摘要、显式生命周期与回复状态；不接收反馈正文或人员字段，不访问平台，不推进 checkpoint，不执行回复或删除。
verification:
  level: local
  report: /verifications/feedback/observation-reconciliation/report.json
---

# 对账反馈观察

输入是同一 source/target 的 prior 与 current observation window，每窗最多 500 个已去身份化 item。可见 item 必须有 SHA-256 语义摘要；删除/隐藏 tombstone 不得携带正文摘要，避免把不可见内容继续当作当前事实。

输出逐项区分新增、编辑、回复状态变化、明确删除/隐藏、重新出现与未变化。上次存在、本次没有的 item 被列入 `missingUnresolved`；完整页、全量导出或 webhook 的具体完整语义仍必须由上游能力证明，本能力不替它猜测。

本地 probe 已验证复合编辑+回复变化、显式删除、未决缺失、checkpoint proposal、输入顺序无关的确定性重放，以及正文/人员字段拒绝。它没有证明任何平台能提供 tombstone、全量窗口或稳定外部 ID，也没有做主题聚类、情感分析、频率外推、回复或 roadmap 决策。

- [输入 Schema](../../schemas/feedback/reconcile-feedback-observations-input.schema.json)
- [输出 Schema](../../schemas/feedback/reconcile-feedback-observations-output.schema.json)
- [验证报告](../../verifications/feedback/observation-reconciliation/report.json)

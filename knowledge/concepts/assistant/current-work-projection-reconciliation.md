---
type: Concept
title: Current Work Projection Reconciliation
description: 最近持久 Session 的未消费增量、逐 Session checkpoint、current 投影变更与未确认知识 proposal 的有界恢复结果。
tags: [assistant, current-work, reconciliation, checkpoint, recovery]
generated: { by: connector:current-work-projection-reconciler, at: 2026-08-27T10:42:18.400Z }
verified:
  - { by: probe:current-work-projection-reconciliation-local-20260827, at: 2026-08-27T10:42:18.400Z }
status: experimental
stale_after: 2026-09-26T10:42:18.400Z
sources:
  - id: capability
    resource: ../../capabilities/assistant/reconcile-current-work-projection.md
    title: 对账当前工作投影
    author: capability:assistant.reconcile-current-work-projection
  - id: verified-snapshot
    resource: ../../verifications/assistant/current-work-projection-reconciliation/snapshot.json
    title: Verified current-work projection reconciliation
    author: probe:current-work-projection-reconciliation-local
---

# Current Work Projection Reconciliation

这是一次增量恢复事实，不是完整历史快照。它列出本轮确实更新 current 的 prior Session、确实推进 checkpoint 的 Session、被明确跳过的 Session 和未确认 proposal；正文、cwd、cursor 数值、provider/model 与仓库路径都不进入对象。

`reconciled` 不等于“所有 Session 已处理”：当前 production seam 有 12 个最近 Session 的上限，且来源读取失败不能被完整枚举。对象因此固定声明不完整覆盖。它也不能代表 current 已从零重建，或丢失/损坏 cursor 已修复。

- [输出 Schema](../../schemas/assistant/reconcile-current-work-projection-output.schema.json)
- [验证样本](../../verifications/assistant/current-work-projection-reconciliation/snapshot.json)

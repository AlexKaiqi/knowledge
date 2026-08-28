---
type: Concept
title: Feedback Intake Withdrawal Receipt
description: 证明一个既有反馈 Storage Receipt 对应记录已从指定用户控制 store 逻辑删除的事务回执，并显式保留未覆盖的介质、备份和下游副本边界。
tags: [feedback, withdrawal, logical-deletion, receipt, recovery, limitations]
generated: { by: connector:feedback-intake-local-withdrawal, at: 2026-08-27T10:03:30.907Z }
verified:
  - { by: probe:feedback-intake-local-withdrawal-local-20260827, at: 2026-08-27T10:03:30.907Z }
status: experimental
stale_after: 2026-09-26T10:03:30.907Z
sources:
  - id: capability
    resource: ../../capabilities/feedback/withdraw-consented-intake-record.md
    title: 撤回经同意的反馈接收记录
    author: capability:feedback.withdraw-consented-intake-record
  - id: local-report
    resource: ../../verifications/feedback/intake-local-withdrawal/report.json
    title: Local-write withdrawal verification report
    author: probe:feedback-intake-local-withdrawal-local
---

# Feedback Intake Withdrawal Receipt

该回执绑定原 storage receipt、intake revision hash、record digest、撤回请求、撤回机制、可信 grant receipt、事务时间与幂等键。`recordPresent=false`、`logicalDeletionApplied=true` 和 `withdrawalApplied=true` 只陈述配置 store 中的记录已经经过可恢复的逻辑删除事务。

`replayed` 区分首次完成与准确重放，但两者引用同一撤回事实。回执不包含原反馈正文、文件路径或人员身份，也不授予进一步动作。

`mediaSanitized=false`、`backupsPurged=false` 和 `downstreamCopiesDeleted=false` 是实质边界，不是待美化状态。它们防止把 filesystem unlink 冒充安全擦除或跨系统删除。若反馈曾进入备份、索引、分析集、平台或知识库，每个控制域必须分别执行、验证并签发自己的删除回执。

- [输出 Schema](../../schemas/feedback/withdraw-consented-intake-record-output.schema.json)
- [验证样本](../../verifications/feedback/intake-local-withdrawal/snapshot.json)

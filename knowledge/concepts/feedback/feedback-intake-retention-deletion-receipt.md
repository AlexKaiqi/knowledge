---
type: Concept
title: Feedback Intake Retention Deletion Receipt
description: 证明准确反馈记录在其不可变 retention deadline 到期、策略授权删除且无 hold 后，已从指定本地 store 逻辑删除的事务回执。
tags: [feedback, retention, expiry, logical-deletion, receipt, hold]
generated: { by: connector:feedback-intake-local-retention-expiry, at: 2026-08-27T10:13:09.345Z }
verified:
  - { by: probe:feedback-intake-local-retention-expiry-local-20260827, at: 2026-08-27T10:13:09.345Z }
status: experimental
stale_after: 2026-09-26T10:13:09.345Z
sources:
  - id: capability
    resource: ../../capabilities/feedback/expire-consented-intake-record.md
    title: 清理到期的反馈接收记录
    author: capability:feedback.expire-consented-intake-record
  - id: local-report
    resource: ../../verifications/feedback/intake-local-retention-expiry/report.json
    title: Local-write retention expiry verification report
    author: probe:feedback-intake-local-retention-expiry-local
---

# Feedback Intake Retention Deletion Receipt

该回执绑定 storage receipt、intake revision hash、record digest、retention policy、不可变 `deleteAfter`、可信 policy grant receipt、删除时间与幂等键。它不包含反馈正文、路径、人员身份、调度器信息或 legal-hold 内部实现。

`recordPresent=false` 与 `retentionDeletionApplied=true` 只证明配置 store 中的逻辑删除。`withdrawalApplied=false` 防止把保留期清理解释为用户撤回；`mediaSanitized=false`、`backupsPurged=false` 与 `downstreamCopiesDeleted=false` 防止把一个控制域的 unlink 外推到其它存储层。

回执也不证明特定法律规定得到了满足。策略正确性、deadline 合法性、hold 数据完整性、生产时钟和其它副本都需要各自的来源、审阅和效果证据。

- [输出 Schema](../../schemas/feedback/expire-consented-intake-record-output.schema.json)
- [验证样本](../../verifications/feedback/intake-local-retention-expiry/snapshot.json)

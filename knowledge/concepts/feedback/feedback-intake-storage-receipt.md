---
type: Concept
title: Feedback Intake Storage Receipt
description: 证明一份准确的经同意反馈接收 Revision 已在特定用户控制 store 中持久化的内容绑定回执，而非撤回、回复或后续处理授权。
tags: [feedback, intake, storage-receipt, revision, retention, withdrawal]
generated: { by: connector:feedback-intake-local-store, at: 2026-08-27T09:43:27.285Z }
verified:
  - { by: probe:feedback-intake-local-storage-local-20260827, at: 2026-08-27T09:43:27.285Z }
status: experimental
stale_after: 2026-09-26T09:43:27.285Z
sources:
  - id: capability
    resource: ../../capabilities/feedback/persist-consented-intake-revision.md
    title: 持久化经人审的反馈接收 Revision
    author: capability:feedback.persist-consented-intake-revision
  - id: local-report
    resource: ../../verifications/feedback/intake-local-storage/report.json
    title: Local-write verification report
    author: probe:feedback-intake-local-storage-local
---

# Feedback Intake Storage Receipt

这份回执把 `storeRef`、`intakeRevisionRef/hash`、内部记录摘要、存储时间、删除期限、撤回机制、人审授权回执和幂等键绑定在一起。`receiptRef` 与 `recordDigest` 允许下游引用同一持久化事实，而不把文件路径或完整反馈正文暴露到 OKF 表面。

`replayed` 区分首次提交和准确重放，但两者引用同一记录；它不表示反馈被重复收集。`stored=true` 是唯一已发生的业务效果。`withdrawalApplied`、`replySent`、`platformWritten`、`knowledgeWritten` 和 `executionAuthorized` 均固定为 `false`，因此回执不能被解释为同意任意后续用途。

删除期限和撤回机制只是被存储的义务引用，不证明系统已经按期删除或完成撤回。后续撤回/删除能力必须消费本回执、核对目标和权限，并签发独立效果回执。

- [输出 Schema](../../schemas/feedback/persist-consented-intake-revision-output.schema.json)
- [验证样本](../../verifications/feedback/intake-local-storage/snapshot.json)

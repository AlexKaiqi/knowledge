---
type: Tool
title: 反馈接收本地到期清理器
description: 在准确 retention deadline 到期、策略允许删除且无 hold 时，逻辑删除私有本地反馈记录并签发可恢复回执。
tags: [feedback, retention, expiry, local-delete, hold, receipt]
generated: { by: connector:feedback-intake-local-retention-expiry, at: 2026-08-27T10:13:09.345Z }
verified:
  - { by: probe:feedback-intake-local-retention-expiry-local-20260827, at: 2026-08-27T10:13:09.345Z }
status: experimental
stale_after: 2026-09-26T10:13:09.345Z
sources:
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: ico-storage-limitation
    resource: https://ico.org/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
    title: Principle (e) — Storage limitation
    author: organization:ico
  - id: nist-media-sanitization
    resource: https://csrc.nist.gov/pubs/sp/800/88/r2/final
    title: Guidelines for Media Sanitization
    author: organization:nist
  - id: local-verification
    resource: ../verifications/feedback/intake-local-retention-expiry/report.json
    title: Feedback intake retention expiry verification
    author: probe:feedback-intake-local-retention-expiry-local
---

# 反馈接收本地到期清理器

这是一个有副作用的本地工具。它从隐藏 store 读取准确 storage receipt 与 retention metadata；公开调用者不能提供路径、到期布尔值、删除 disposition 或 hold 状态。早于 deadline 时无副作用；到期后仍需可信 grant 同时确认删除 disposition 和 clear hold。

执行使用可恢复 journal，删除后签发独立 `Feedback Intake Retention Deletion Receipt`。隐藏 Collector 只能提出到期候选，不会自动执行本工具。

工具不代表生产 scheduler 或 legal-hold 系统已经接线，不把本地 unlink 冒充介质、备份和下游副本清除，也不把到期清理冒充用户撤回。

- [清理到期的反馈接收记录](../capabilities/feedback/expire-consented-intake-record.md)
- [Feedback Intake Retention Deletion Receipt](../concepts/feedback/feedback-intake-retention-deletion-receipt.md)

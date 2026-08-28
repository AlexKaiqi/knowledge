---
type: Capability
title: 清理到期的反馈接收记录
description: 在不可变 retention deadline 到期且可信策略授权明确允许删除、无 active hold 时，从用户控制的本地 store 逻辑删除准确记录并签发到期清理回执。
tags: [feedback, intake, retention, expiry, deletion, receipt, local-write]
outcomes: [feedback-collection, product-research]
generated: { by: connector:feedback-intake-local-retention-expiry, at: 2026-08-27T10:13:09.345Z }
verified:
  - { by: probe:feedback-intake-local-retention-expiry-local-20260827, at: 2026-08-27T10:13:09.345Z }
status: experimental
stale_after: 2026-09-26T10:13:09.345Z
sources:
  - id: subject
    resource: ../../tools/feedback-intake-local-retention-expiry.md
    title: 反馈接收本地到期清理器
    author: tool:feedback-intake-local-retention-expiry
  - id: upstream-storage
    resource: persist-consented-intake-revision.md
    title: 持久化经人审的反馈接收 Revision
    author: capability:feedback.persist-consented-intake-revision
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: ico-storage-limitation
    resource: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
    title: Principle (e) — Storage limitation
    author: organization:ico
  - id: node-filesystem-api
    resource: https://nodejs.org/api/fs.html
    title: Node.js File system API
    author: organization:nodejs
  - id: nist-media-sanitization
    resource: https://csrc.nist.gov/pubs/sp/800/88/r2/final
    title: NIST SP 800-88 Rev. 2 — Guidelines for Media Sanitization
    author: organization:nist
  - id: local-report
    resource: ../../verifications/feedback/intake-local-retention-expiry/report.json
    title: Local-write retention expiry verification report
    author: probe:feedback-intake-local-retention-expiry-local
capability:
  id: feedback.expire-consented-intake-record
  version: 1.0.0
  subjectRef: /tools/feedback-intake-local-retention-expiry.md
  kind: operation
  effect: local-write
  inputSchema: /schemas/feedback/expire-consented-intake-record-input.schema.json
  outputSchema: /schemas/feedback/expire-consented-intake-record-output.schema.json
  resultConcepts: [/concepts/feedback/feedback-intake-retention-deletion-receipt.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 调用者只能引用既有 storage receipt、record digest、原始 retention policy/deadline、可信 retention grant ref 和幂等键；不能提供路径、自报到期、删除 disposition 或 hold 状态。Connector 重新核对私有记录且只在当前时间达到准确 deleteAfter 后调用可信策略验证器；验证器必须精确绑定目标并返回 disposition=delete、holdStatus=clear。回执不证明法律合规、用户撤回、介质/备份/下游副本清除或自动调度。
verification:
  level: local
  report: /verifications/feedback/intake-local-retention-expiry/report.json
---

# 清理到期的反馈接收记录

这项能力与用户撤回分开。公开输入引用 `Feedback Intake Storage Receipt`、record digest、原始 retention policy/deadline、可信 grant ref 和幂等键；隐藏 Connector 从私有 envelope 重新验证 policy 与 `deleteAfter`。到期前立即失败，不调用授权验证器，也不创建 journal。到期后仍不能自动删除：可信策略验证器必须精确绑定 capability/effect/store/receipt/digest/policy/deadline，并明确返回 `disposition=delete` 与 `holdStatus=clear`。

隐藏 Maintainer 可枚举不含正文和路径的 retention 候选，只为到期项生成 proposal；它不会调用本能力。显式执行后，Connector 使用独占 pending journal、unlink、目录同步和 committed receipt，支持准确并发、幂等重放及 unlink 后中断恢复。变更 deadline、policy、幂等键，或遇到 active hold、伪授权、篡改和路径注入都会失败。

本地 probe 使用固定到期时钟（deadline 后一秒）验证时间门，但创建、unlink、sync、崩溃恢复和清理都是真实文件系统效果。因此它证明到期判断与本地逻辑删除契约，不证明生产 scheduler、策略/hold 数据源或系统时钟已经接入。当前 grant provider 仍是 scripted，状态保持 `experimental`。

`retentionDeletionApplied=true` 只表示这个 store 中的准确记录已按到期事务逻辑删除。`withdrawalApplied`、`mediaSanitized`、`backupsPurged` 和 `downstreamCopiesDeleted` 固定为 `false`；其它控制域必须分别执行和签发回执。

- [输入 Schema](../../schemas/feedback/expire-consented-intake-record-input.schema.json)
- [输出 Schema](../../schemas/feedback/expire-consented-intake-record-output.schema.json)
- [验证报告](../../verifications/feedback/intake-local-retention-expiry/report.json)

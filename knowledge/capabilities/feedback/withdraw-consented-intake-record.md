---
type: Capability
title: 撤回经同意的反馈接收记录
description: 在可信撤回授权后，以既有 Storage Receipt 为目标，从用户控制的本地 store 逻辑删除准确反馈记录，并签发可恢复、可重放的撤回回执。
tags: [feedback, intake, withdrawal, erasure, receipt, idempotency, local-write]
outcomes: [feedback-collection, product-research]
generated: { by: connector:feedback-intake-local-withdrawal, at: 2026-08-27T10:03:30.907Z }
verified:
  - { by: probe:feedback-intake-local-withdrawal-local-20260827, at: 2026-08-27T10:03:30.907Z }
status: experimental
stale_after: 2026-09-26T10:03:30.907Z
sources:
  - id: subject
    resource: ../../tools/feedback-intake-local-withdrawal.md
    title: 反馈接收本地撤回器
    author: tool:feedback-intake-local-withdrawal
  - id: upstream-storage
    resource: persist-consented-intake-revision.md
    title: 持久化经人审的反馈接收 Revision
    author: capability:feedback.persist-consented-intake-revision
  - id: node-filesystem-api
    resource: https://nodejs.org/api/fs.html
    title: Node.js File system API
    author: organization:nodejs
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: nist-media-sanitization
    resource: https://csrc.nist.gov/pubs/sp/800/88/r2/final
    title: NIST SP 800-88 Rev. 2 — Guidelines for Media Sanitization
    author: organization:nist
  - id: local-report
    resource: ../../verifications/feedback/intake-local-withdrawal/report.json
    title: Local-write withdrawal verification report
    author: probe:feedback-intake-local-withdrawal-local
capability:
  id: feedback.withdraw-consented-intake-record
  version: 1.0.0
  subjectRef: /tools/feedback-intake-local-withdrawal.md
  kind: operation
  effect: local-write
  inputSchema: /schemas/feedback/withdraw-consented-intake-record-input.schema.json
  outputSchema: /schemas/feedback/withdraw-consented-intake-record-output.schema.json
  resultConcepts: [/concepts/feedback/feedback-intake-withdrawal-receipt.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 调用者只能引用既有 storage receipt、record digest、撤回请求/机制、可信 grant ref 和幂等键；不能提供文件路径或自报授权。Connector 只接受绑定 capability/effect/store/receipt/digest/request/mechanism 且当前有效的可信撤回 grant。回执只证明该配置 store 中的逻辑删除；不证明介质清除、备份清除、下游副本删除或法律合规，也不执行回复或平台写入。
verification:
  level: local
  report: /verifications/feedback/intake-local-withdrawal/report.json
---

# 撤回经同意的反馈接收记录

这项能力消费 `Feedback Intake Storage Receipt`，不重新接收反馈正文，也不接受路径或 `approved=true`。隐藏 Connector 在预配置的用户控制 store 中找到唯一匹配记录，验证 envelope 与 record digest，再调用可信授权验证器，要求授权精确绑定本能力、`local-write` effect、store、storage receipt、记录摘要、撤回请求与原始撤回机制。

删除采用持久事务 journal：先以独占方式落盘 `pending` 事务并同步目录，再 unlink 准确记录并同步 records 目录，最后把 journal 提交为带独立回执的 `committed` 状态。即使进程在 unlink 前或 unlink 后中断，同一请求也能恢复；准确并发和后续重放只留下一个 journal 和同一回执。换幂等键、换请求、篡改记录、伪授权或路径注入都会失败。

本地 probe 实际创建上游反馈记录，再删除、读回 journal、模拟 unlink 后崩溃并恢复，最后清理全部临时 store。它证明的是这个 store 目录中的逻辑删除。Node.js `unlink` 不等同于 NIST 定义的 media sanitization，因此 `mediaSanitized`、`backupsPurged` 与 `downstreamCopiesDeleted` 固定为 `false`；任何备份、搜索索引、分析集或外部平台副本都需要各自的删除能力与回执。

真实产品的人审/撤回授权签发器仍未接入，probe 使用 scripted trusted grant provider，所以当前为 `experimental`。到期保留清理也不是本能力：它应由独立 Collector/执行能力按 retention policy 触发并对账。

- [输入 Schema](../../schemas/feedback/withdraw-consented-intake-record-input.schema.json)
- [输出 Schema](../../schemas/feedback/withdraw-consented-intake-record-output.schema.json)
- [验证报告](../../verifications/feedback/intake-local-withdrawal/report.json)

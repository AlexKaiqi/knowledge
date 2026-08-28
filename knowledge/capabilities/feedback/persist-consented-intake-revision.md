---
type: Capability
title: 持久化经人审的反馈接收 Revision
description: 在可信人审授权后，把准确的经同意反馈接收 Revision 原子写入用户控制的私有本地存储，并返回可重放的存储回执。
tags: [feedback, intake, storage, consent, human-review, receipt, idempotency, local-write]
outcomes: [feedback-collection, product-research]
generated: { by: connector:feedback-intake-local-store, at: 2026-08-27T09:43:27.285Z }
verified:
  - { by: probe:feedback-intake-local-storage-local-20260827, at: 2026-08-27T09:43:27.285Z }
status: experimental
stale_after: 2026-09-26T09:43:27.285Z
sources:
  - id: subject
    resource: ../../tools/feedback-intake-local-store.md
    title: 反馈接收本地存储器
    author: tool:feedback-intake-local-store
  - id: upstream-revision
    resource: prepare-consented-intake-review-revision.md
    title: 准备经同意的反馈接收审阅 Revision
    author: capability:feedback.prepare-consented-intake-review-revision
  - id: node-filesystem-api
    resource: https://nodejs.org/api/fs.html
    title: Node.js File system API
    author: organization:nodejs
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: local-report
    resource: ../../verifications/feedback/intake-local-storage/report.json
    title: Local-write verification report
    author: probe:feedback-intake-local-storage-local
capability:
  id: feedback.persist-consented-intake-revision
  version: 1.0.0
  subjectRef: /tools/feedback-intake-local-store.md
  kind: operation
  effect: local-write
  inputSchema: /schemas/feedback/persist-consented-intake-revision-input.schema.json
  outputSchema: /schemas/feedback/persist-consented-intake-revision-output.schema.json
  resultConcepts: [/concepts/feedback/feedback-intake-storage-receipt.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 调用者只能引用预配置的 opaque store、准确 intake revision hash、可信 review grant ref 和幂等键；不能提供文件路径、自报 approved 或替换授权验证器。Connector 隐藏 revision resolver、实际路径和 grant verifier，并只接受绑定 capability/effect/store/revision 且当前有效的可信授权。能力只证明本地存储，不执行撤回、删除、回复、平台写入或知识写入。
verification:
  level: local
  report: /verifications/feedback/intake-local-storage/report.json
---

# 持久化经人审的反馈接收 Revision

这项能力接在 `feedback.prepare-consented-intake-review-revision` 之后。公开输入没有反馈正文、文件路径或 `approved=true`：调用者只提交 store ref、已验证 revision 的引用和 hash、review grant ref 与幂等键。隐藏的 Connector 重新解析完整 Revision、复算其 canonical hash，并调用可信授权验证器核对授权是否精确绑定本能力、`local-write` effect、目标 store 与 revision hash。

授权通过后，Connector 在配置的用户控制目录中写入一份私有 envelope。记录绑定完整 intake revision、人审回执、存储时间、删除期限和撤回机制；输出只暴露内容摘要与 `Feedback Intake Storage Receipt`。同一 submission 只有一个记录槽：准确重放（包括并发重放）返回同一回执，改换 revision 或幂等键不能静默覆盖已有反馈。

本地 probe 实际创建、同步、读回并清理了隔离存储，验证文件 mode 为 `0600`，并覆盖并发、篡改、伪授权、冲突与路径注入。Node.js 文档仍警告并发文件系统修改不能天然视为同步安全，因此实现使用独占临时文件、文件同步、硬链接提交和目录同步，而不是把普通覆盖写冒充原子提交。

`stored=true` 只说明该 Revision 已进入这个本地 store。`withdrawalApplied`、`replySent`、`platformWritten`、`knowledgeWritten` 和 `executionAuthorized` 固定为 `false`。撤回/删除必须成为引用本回执的独立能力；真实产品的人审 UI 与授权签发器尚未接入，因此当前状态为 `experimental`，不能把 probe 中的 scripted grant provider 当生产授权系统。

- [输入 Schema](../../schemas/feedback/persist-consented-intake-revision-input.schema.json)
- [输出 Schema](../../schemas/feedback/persist-consented-intake-revision-output.schema.json)
- [验证报告](../../verifications/feedback/intake-local-storage/report.json)

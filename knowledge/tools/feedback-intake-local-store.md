---
type: Tool
title: 反馈接收本地存储器
description: 用准确 revision 与可信人审授权，把一条经同意反馈原子写入预配置私有本地存储并签发幂等回执。
tags: [feedback, intake, local-storage, receipt, idempotency, authorization]
generated: { by: connector:feedback-intake-local-store, at: 2026-08-27T09:43:27.285Z }
verified:
  - { by: probe:feedback-intake-local-storage-local-20260827, at: 2026-08-27T09:43:27.285Z }
status: experimental
stale_after: 2026-09-26T09:43:27.285Z
sources:
  - id: node-filesystem-api
    resource: https://nodejs.org/api/fs.html
    title: Node.js File system API
    author: organization:nodejs
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: local-verification
    resource: ../verifications/feedback/intake-local-storage/report.json
    title: Feedback intake local storage verification
    author: probe:feedback-intake-local-storage-local
---

# 反馈接收本地存储器

这是一个有副作用的本地工具。它只接受 opaque store/revision/grant refs、revision hash 与幂等键；真实根目录、Revision resolver 和可信 review grant verifier 留在隐藏 Connector 中。它重新验证上游 Revision 的 canonical 内容与 `ready-for-human-review` 状态，也要求授权精确绑定本能力、`local-write`、store 与 revision。

写入采用私有临时文件、同步、硬链接提交与目录同步；按 submission 固定记录槽，准确重放返回同一回执，内容或幂等键变化则失败。工具不接收正文作为新的事实，不允许调用者选择绝对路径，也不从布尔字段推断授权。

当前仅用隔离的真实本地写入和 scripted trusted grant provider 验证了 Connector 契约。它不代表生产人审系统已接入，也不执行撤回、删除、回复、主题归纳、平台写入或知识写入。

- [持久化经人审的反馈接收 Revision](../capabilities/feedback/persist-consented-intake-revision.md)
- [Feedback Intake Storage Receipt](../concepts/feedback/feedback-intake-storage-receipt.md)

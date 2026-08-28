---
type: Tool
title: 持久记忆变更审阅 Revision 准备器
description: 将一项 USER.md 或 knowledge/*.md 写入/遗忘提案与精确内容哈希、来源和当前目标状态冻结为人审 revision；不创建提案也不写入。
tags: [personal-assistant, durable-memory, proposal, conflict, git, human-review, non-authorization]
generated: { by: connector:durable-memory-change-review-revision, at: 2026-08-27T04:16:30Z }
verified:
  - { by: probe:durable-memory-change-review-revision-local-20260827, at: 2026-08-27T04:16:30Z }
status: stable
stale_after: 2026-09-26T04:16:30Z
sources:
  - id: personal-knowledge-service
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Personal Knowledge Base proposal, conflict, apply and receipt implementation
    author: organization:alex-kaiqi
  - id: personal-knowledge-layout
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json
    title: Personal Knowledge repository flow contract
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/assistant/durable-memory-change-review-revision/report.json
    title: Durable memory change review verification
    author: probe:durable-memory-change-review-revision-local
---

# 持久记忆变更审阅 Revision 准备器

这个本地工具解决“哪些内容应该进入长期记忆、改哪里、基于哪一版”这一窄问题。输入一项 `upsert` 或 `delete`、目标 `USER.md`/直接 `knowledge/*.md`、当前与提案基线内容摘要、完整 Markdown、理由、来源和证据；输出冻结后的审阅 revision。

Connector 采用当前 Personal Knowledge Base 的真实语义：Markdown 去首尾空白并以换行结尾；`USER.md` 保持 2000 字符预算；目标变化后不猜测合并，而是返回 `target-changed-after-proposal`；当前状态已经等于期望状态时返回 `already-satisfied`。

`ready-for-human-review` 仍有七项 pending 检查，包括内容是否真的值得跨任务保留、来源、敏感信息、推断、冲突和遗忘后果。它不创建生产 proposal、不调用 apply、不写 Markdown、不 commit、不签发 receipt，也不接受 `confirmed`。

- [准备持久记忆变更审阅 Revision](../capabilities/assistant/prepare-durable-memory-change-review-revision.md)
- [Durable Memory Change Review Revision](../concepts/assistant/durable-memory-change-review-revision.md)

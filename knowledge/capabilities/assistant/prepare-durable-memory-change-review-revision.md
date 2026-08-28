---
type: Capability
title: 准备持久记忆变更审阅 Revision
description: 为一项长期记忆写入或遗忘准备内容寻址、冲突可见、待人工确认的 revision，不修改知识仓库。
tags: [personal-assistant, durable-memory, proposal, forget, conflict, git, human-review]
outcomes: [product-research]
generated: { by: connector:durable-memory-change-review-revision, at: 2026-08-27T04:16:30Z }
verified:
  - { by: probe:durable-memory-change-review-revision-local-20260827, at: 2026-08-27T04:16:30Z }
status: stable
stale_after: 2026-09-26T04:16:30Z
sources:
  - id: subject
    resource: ../../tools/durable-memory-change-review-revision.md
    title: 持久记忆变更审阅 Revision 准备器
    author: tool:durable-memory-change-review-revision
  - id: production-service
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Production proposal and conflict semantics
    author: organization:alex-kaiqi
  - id: production-layout
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json
    title: Proposal-confirmation-write-commit-receipt flow
    author: organization:alex-kaiqi
  - id: local-report
    resource: ../../verifications/assistant/durable-memory-change-review-revision/report.json
    title: Local verification report
    author: probe:durable-memory-change-review-revision-local
capability:
  id: assistant.prepare-durable-memory-change-review-revision
  version: 1.0.0
  subjectRef: /tools/durable-memory-change-review-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/prepare-durable-memory-change-review-revision-input.schema.json
  outputSchema: /schemas/assistant/prepare-durable-memory-change-review-revision-output.schema.json
  resultConcepts: [/concepts/assistant/durable-memory-change-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入和结果包含个人长期记忆正文，只能在主人授权的本地审阅面短期保留。能力不接受 confirmed/approve，不创建 PKB proposal，不读写仓库，不 commit，不签发 receipt；输出不能作为 apply 授权依据。
verification:
  level: local
  report: /verifications/assistant/durable-memory-change-review-revision/report.json
---

# 准备持久记忆变更审阅 Revision

输入单个 owner scope、知识仓库 revision 引用、精确目标状态，以及一个 `upsert`/`delete` 变更。目标只能是 `USER.md` 或一个直属 `knowledge/*.md` 文件；upsert 按生产实现规范化完整 Markdown，delete 明确要求 `content=null`。

Connector 比较 base、current 和 desired digest：无漂移时生成内容寻址的人审 revision；目标已满足时报告幂等；目标发生并发变化时阻断。它不尝试语义 merge，也不把整仓库 revision 漂移误当成目标文件冲突。

本地 probe 不只测试纯函数：它加载当前生产 Personal Knowledge Base，在隔离临时 Git 仓库实际跑完 proposal、`confirmed=true` apply、原子写、commit 和 receipt，并制造一次并发编辑确认生产 conflict gate 生效。临时仓库随后删除；公开 Connector 在相同测试中保持 `proposalCreated/applied/committed/receiptIssued/executionAuthorized=false`。

没有验证真实主人点击、生产个人知识内容、自动抽取、语义去重、merge UI 或长期 retention，因此这些不能从该能力推断。

- [输入 Schema](../../schemas/assistant/prepare-durable-memory-change-review-revision-input.schema.json)
- [输出 Schema](../../schemas/assistant/prepare-durable-memory-change-review-revision-output.schema.json)
- [验证报告](../../verifications/assistant/durable-memory-change-review-revision/report.json)

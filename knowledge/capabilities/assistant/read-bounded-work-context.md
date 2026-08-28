---
type: Capability
title: 读取有界工作上下文
description: 按 query 和字符预算读取当前工作、相关先前 Session 片段与匹配长期知识，返回临时、有来源且不授权执行的工作上下文。
tags: [personal-assistant, current-context, session, memory, provenance, privacy]
outcomes: [product-research]
generated: { by: connector:bounded-work-context-projection, at: 2026-08-27T06:37:55Z }
verified:
  - { by: probe:bounded-work-context-local-20260827, at: 2026-08-27T06:37:55Z }
status: stable
stale_after: 2026-09-26T06:37:55Z
sources:
  - id: subject
    resource: ../../tools/bounded-work-context-projection.md
    title: 有界工作上下文投影器
    author: tool:bounded-work-context-projection
  - id: local-report
    resource: ../../verifications/assistant/bounded-work-context/report.json
    title: Local verification report
    author: probe:bounded-work-context-local
capability:
  id: assistant.read-bounded-work-context
  version: 1.0.0
  subjectRef: /tools/bounded-work-context-projection.md
  kind: query
  effect: none
  inputSchema: /schemas/assistant/read-bounded-work-context-input.schema.json
  outputSchema: /schemas/assistant/read-bounded-work-context-output.schema.json
  resultConcepts: [/concepts/assistant/bounded-work-context-projection.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: optional
    agentInvolvement: none
access:
  class: owned
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: prohibited
  authorizationNotes: 当前 Session 与 Workspace 必须由可信运行时绑定；调用者不能提交真实 cwd 或其它 owner 的 Session。投影只能瞬时用于当前模型请求，不得持久保存原始历史片段、跨 owner 关联、修改知识或授权动作。
verification:
  level: local
  report: /verifications/assistant/bounded-work-context/report.json
---

# 读取有界工作上下文

该能力解决“当前要做什么、先前相关工作是什么、哪些长期知识值得本轮看到”，而不是“历史中发生过什么”。Session 仍是原始历史；`.pkb/current.md` 是可重建当前投影；`knowledge/*.md` 是确认后的长期知识；本结果只是 query-time view。

生产 Personal Knowledge Base 的固定版本在隔离临时仓库中真实执行：current summary、一个相关先前 Session 片段和一个匹配长期知识文档进入投影；当前 Session 被排除在先前历史来源之外，关闭 prior Sessions 后不返回任何 `session:*` 来源，紧预算仍不溢出。公共结果只保留逻辑来源和内容摘要，不暴露真实 cwd 或 Git revision。

本能力不调用维护模型，不写 current projection，不推进 cursor，不创建知识 proposal，也不授权执行。`projectionComplete=false` 是固定边界：它不能用来证明上下文、历史或知识完整。

- [输入 Schema](../../schemas/assistant/read-bounded-work-context-input.schema.json)
- [输出 Schema](../../schemas/assistant/read-bounded-work-context-output.schema.json)
- [验证报告](../../verifications/assistant/bounded-work-context/report.json)

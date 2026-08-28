---
type: Tool
title: 有界工作上下文投影器
description: 以 opaque Session/Workspace 引用读取当前工作、相关历史与匹配长期知识，返回临时且有来源的有界上下文。
tags: [personal-assistant, work-context, session, knowledge, projection, privacy]
generated: { by: connector:bounded-work-context-projection, at: 2026-08-27T06:37:55Z }
verified:
  - { by: probe:bounded-work-context-local-20260827, at: 2026-08-27T06:37:55Z }
status: stable
stale_after: 2026-09-26T06:37:55Z
sources:
  - id: personal-knowledge-service
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Personal Knowledge Base projection implementation
    author: organization:alex-kaiqi
  - id: repository-layout
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json
    title: Personal Knowledge repository boundaries
    author: organization:alex-kaiqi
  - id: production-e2e
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/eval/evidence/latest.md
    title: Personal Knowledge E2E evidence
    author: project:dsh-personal-knowledge-base
  - id: local-verification
    resource: ../verifications/assistant/bounded-work-context/report.json
    title: Bounded work context local verification
    author: probe:bounded-work-context-local
---

# 有界工作上下文投影器

调用者只提供 query、当前 `session:*`、opaque `workspace:*`、字符预算以及是否允许读取先前 Session。隐藏运行时解析真实 Workspace，并组合可重建 current projection、相关历史片段和匹配长期 Markdown；公共结果不暴露 cwd、Git revision、内部 route 或 provider 字段。

读取结果只在当前调用中使用。它不更新 `.pkb/current.md`、不推进 Session cursor、不修改长期知识，也不因为某段上下文提到动作就授予执行权限。

- [读取有界工作上下文](../capabilities/assistant/read-bounded-work-context.md)
- [Bounded Work Context Projection](../concepts/assistant/bounded-work-context-projection.md)

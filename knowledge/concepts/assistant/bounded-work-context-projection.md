---
type: Concept
title: Bounded Work Context Projection
description: 从可重建当前工作、相关历史 Session 片段和匹配长期知识组成的临时、有来源、受字符预算限制的模型上下文。
tags: [personal-assistant, current-work, session, context, projection, provenance, privacy]
generated: { by: connector:bounded-work-context-projection, at: 2026-08-27T06:37:55Z }
verified:
  - { by: probe:bounded-work-context-local-20260827, at: 2026-08-27T06:37:55Z }
status: stable
stale_after: 2026-09-26T06:37:55Z
sources:
  - id: production-projection
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Personal Knowledge query-time projection
    author: organization:alex-kaiqi
  - id: local-snapshot
    resource: ../../verifications/assistant/bounded-work-context/snapshot.json
    title: Bounded work context local snapshot
    author: probe:bounded-work-context-local
---

# Bounded Work Context Projection

它是一次模型请求使用的临时视图，不是 Session 历史副本，也不是新的长期知识事实源。当前工作来自 `.pkb/current.md`，历史只通过 `session:*` 逻辑引用和有界相关片段出现，长期知识只包含 query 命中的普通 Markdown。

`projectionComplete=false` 表示字符预算和来源选择可能省略内容；它不表示当前所有任务、历史或知识都已枚举。`contextDigest` 只绑定本次文本，不能作为执行幂等键、授权或持久知识 revision。

- [输出 Schema](../../schemas/assistant/read-bounded-work-context-output.schema.json)
- [验证样本](../../verifications/assistant/bounded-work-context/snapshot.json)

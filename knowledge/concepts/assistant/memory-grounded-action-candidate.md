---
type: Concept
title: Memory-grounded Action Candidate
description: 带逐字段来源、claim/provenance、未决原因和非授权声明的动作候选参数。
tags: [assistant, action-candidate, memory, provenance, unresolved, authorization]
generated: { by: connector:memory-action-grounding, at: 2026-08-27T02:11:29Z }
verified:
  - { by: probe:memory-action-grounding-local-20260827, at: 2026-08-27T02:11:29Z }
status: stable
stale_after: 2026-09-26T02:11:29Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/memory-action-grounding/snapshot.json
    title: Verified memory-grounded action candidate
    author: connector:memory-action-grounding
---

# Memory-grounded Action Candidate

Action Candidate 是准备阶段制品，不是 ToolCall、授权或执行回执。`candidateArguments` 保存通过字段契约的显式值和 memory-grounded 值；`bindings` 逐字段声明 `explicit|memory`，memory binding 必须列出 claim ID 和 provenance ref。

`unresolved` 保留缺失、显式必填、冲突、被争议、inactive、未确认、过期或无效记忆。只有必需字段均已绑定时 `readiness=grounded`；可选字段仍可保留 warning。无论 readiness 如何，`executionAuthorized=false` 固定成立。

该对象不保存原始 Session、完整知识文档或模型推理。它使用字段已绑定 claim，而不是声称能从自然语言自动判断用户真实偏好。

- [输出 Schema](../../schemas/assistant/ground-memory-into-action-candidate-output.schema.json)
- [验证样本](../../verifications/assistant/memory-action-grounding/snapshot.json)

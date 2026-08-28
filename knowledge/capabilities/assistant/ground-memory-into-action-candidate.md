---
type: Capability
title: 将记忆绑定为动作候选参数
description: 按字段授权策略，将本轮显式参数与有 provenance 的确认记忆绑定成不执行、不授权的 Action Candidate。
tags: [personal-assistant, memory, action-grounding, provenance, conflict, staleness]
outcomes: [product-research]
generated: { by: connector:memory-action-grounding, at: 2026-08-27T02:11:29Z }
verified:
  - { by: probe:memory-action-grounding-local-20260827, at: 2026-08-27T02:11:29Z }
status: stable
stale_after: 2026-09-26T02:11:29Z
sources:
  - id: subject
    resource: ../../tools/memory-action-grounding.md
    title: 记忆到动作参数绑定器
    author: tool:memory-action-grounding
  - id: local-report
    resource: ../../verifications/assistant/memory-action-grounding/report.json
    title: Local verification report
    author: probe:memory-action-grounding-local
capability:
  id: assistant.ground-memory-into-action-candidate
  version: 1.0.0
  subjectRef: /tools/memory-action-grounding.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/ground-memory-into-action-candidate-input.schema.json
  outputSchema: /schemas/assistant/ground-memory-into-action-candidate-output.schema.json
  resultConcepts: [/concepts/assistant/memory-grounded-action-candidate.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入 claim 必须由上游以 opaque scope 和 provenance 提供；本能力不读取原始私有历史。结果只可用于准备 action，不能作为授权、确认、幂等键或执行回执。
verification:
  level: local
  report: /verifications/assistant/memory-action-grounding/report.json
---

# 将记忆绑定为动作候选参数

输入声明一个最多 50 个扁平 scalar 字段的 action contract、本轮显式参数、最多 200 条 field-addressed memory claim 和冻结时间。每个字段独立声明是否禁止使用记忆、只允许用户确认记忆，或也允许工具验证状态。

Connector 只绑定 action、scope、field 精确一致，且 active、未过期、authority 足够、类型/枚举有效的 claim。多个 eligible value 不按“最新”“多数”或“更可信”擅自裁决，而是返回 `conflicting-memory`；显式参数优先，但不会因此改写长期记忆。

本地 probe 验证了 Personal Knowledge 的 source projection 和 Pet Assistant 的 untrusted/authorization 边界，并执行了成功绑定、冲突保留与确定性重放。它没有验证自然语言 claim 抽取、嵌套 Tool Schema、真实 action 执行或用户授权，因此这些不能从该能力推断。

- [输入 Schema](../../schemas/assistant/ground-memory-into-action-candidate-input.schema.json)
- [输出 Schema](../../schemas/assistant/ground-memory-into-action-candidate-output.schema.json)
- [验证报告](../../verifications/assistant/memory-action-grounding/report.json)

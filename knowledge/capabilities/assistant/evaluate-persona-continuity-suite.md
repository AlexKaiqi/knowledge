---
type: Capability
title: 评测 Persona 连续性 Suite
description: 对冻结 persona revision 与候选响应执行四轴、多 evaluator、系统事实分离的待人审连续性评测。
tags: [assistant, pet, persona, continuity, evaluation, human-review]
outcomes: [product-research]
generated: { by: connector:persona-continuity-evaluator, at: 2026-08-27T08:23:39.488Z }
verified:
  - { by: probe:persona-continuity-evaluation-local-20260827, at: 2026-08-27T08:23:39.488Z }
status: experimental
stale_after: 2026-09-10T08:23:39.488Z
sources:
  - id: subject
    resource: ../../tools/persona-continuity-evaluator.md
    title: Persona 连续性评测器
    author: tool:persona-continuity-evaluator
  - id: pet-mochi
    resource: https://github.com/cskwork/pet-mochi/blob/efa76839cb31ecf7c126ec0a833d514ac94a92e2/src-tauri/src/llm/prompts.rs
    title: pet-mochi bounded character implementation
    author: project:pet-mochi
  - id: yurios
    resource: https://github.com/yuri-os/YuriOS/blob/c131bb7776c8c961d462e30dacc69c4023497aa8/yurios/app/core/soul.py
    title: YuriOS versioned Soul loader
    author: project:yurios
  - id: anchorbench
    resource: https://github.com/SalesforceAIResearch/AnchorBench/tree/41bd0e20b9524ce484db301ac15dc14121bf06ad
    title: ANCHOR long-horizon companion audit
    author: organization:salesforce-ai-research
  - id: local-report
    resource: ../../verifications/assistant/persona-continuity-evaluation/report.json
    title: Persona continuity evaluation local verification
    author: probe:persona-continuity-evaluation-local
capability:
  id: assistant.evaluate-persona-continuity-suite
  version: 1.0.0
  subjectRef: /tools/persona-continuity-evaluator.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/evaluate-persona-continuity-suite-input.schema.json
  outputSchema: /schemas/assistant/evaluate-persona-continuity-suite-output.schema.json
  resultConcepts: [/concepts/assistant/persona-continuity-evaluation-suite.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: required
access:
  class: public
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 调用者提供并授权处理冻结 persona 与有界情境文本；原文只在评测期存在。能力不读取平台或身份数据，不改变 persona 或记忆，不执行动作，也不授予授权。结果仅作人审评测证据。
verification:
  level: local
  report: /verifications/assistant/persona-continuity-evaluation/report.json
---

# 评测 Persona 连续性 Suite

调用方冻结 persona revision、四类规则和候选响应情境。能力在内部运行多个带版本 evaluator，并把每个 case 的 `role`、`boundary`、`value`、`style` 观察与 `systemTruth` 分开返回。

聚合规则保守：事实偏离优先暴露；evaluator 的 `held/deviated` 冲突保留为 `disagreement`；证据不足保留为 `unknown`。输出没有总分，不声称 evaluator 独立，也不能推断真实用户的陪伴体验、依恋、健康、留存或市场效果。

本地七类 fixture 已验证引用约束、输入不留存、四轴/系统事实分离、分歧不平均、Schema 和零副作用。它使用 scripted evaluator，真实 Agent 的语义判断仍是明确未通过的 L3 缺口；所以能力状态为 experimental 且 `humanReviewRequired=true`。

- [输入 Schema](../../schemas/assistant/evaluate-persona-continuity-suite-input.schema.json)
- [输出 Schema](../../schemas/assistant/evaluate-persona-continuity-suite-output.schema.json)
- [验证报告](../../verifications/assistant/persona-continuity-evaluation/report.json)

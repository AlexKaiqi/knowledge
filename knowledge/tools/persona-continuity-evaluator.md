---
type: Tool
title: Persona 连续性评测器
description: 对冻结 persona revision 与候选响应执行 role、boundary、value、style 和系统事实分离的多 evaluator 评测。
tags: [assistant, pet, persona, continuity, evaluation, disagreement, agentic]
generated: { by: connector:persona-continuity-evaluator, at: 2026-08-27T08:23:39.488Z }
verified:
  - { by: probe:persona-continuity-evaluation-local-20260827, at: 2026-08-27T08:23:39.488Z }
status: experimental
stale_after: 2026-09-10T08:23:39.488Z
sources:
  - id: anchorbench
    resource: https://github.com/SalesforceAIResearch/AnchorBench/tree/41bd0e20b9524ce484db301ac15dc14121bf06ad
    title: ANCHOR long-horizon companion audit
    author: organization:salesforce-ai-research
  - id: local-verification
    resource: ../verifications/assistant/persona-continuity-evaluation/report.json
    title: Persona continuity evaluation local verification
    author: probe:persona-continuity-evaluation-local
---

# Persona 连续性评测器

工具接收冻结的 persona revision、按 `role`、`boundary`、`value`、`style` 分类的规则，以及有界情境和候选响应。内部以 2–4 个带版本的 evaluator profile 逐项判断；调用方看不到也不能选择模型 route。

结果保留每个 evaluator 的 profile、revision、family 和证据 locator。`held` 与 `deviated` 冲突会成为 `disagreement`，不会平均成分数；系统事实单独判断，不能被角色风格覆盖。输入原文只在评测期存在，公共结果仅含摘要和定位符。

当前 probe 使用 scripted evaluator，只证明 schema、规范化、分歧保留与非执行边界。真实模型 judge 的准确性、校准、多语言稳定性和长期陪伴效果尚未验证，因此所有结果都要求人工审阅。

- [能力](../capabilities/assistant/evaluate-persona-continuity-suite.md)
- [Persona Continuity Evaluation Suite](../concepts/assistant/persona-continuity-evaluation-suite.md)

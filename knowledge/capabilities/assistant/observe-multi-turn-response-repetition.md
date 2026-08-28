---
type: Capability
title: 观测多轮助手回复重复
description: 对有界多轮助手回复执行无阈值的原样重复与 2/3-gram 历史重叠观测，并保留合理重复语境供人审。
tags: [assistant, pet, dialogue, repetition, observation, human-review]
outcomes: [product-research]
generated: { by: connector:multi-turn-response-repetition-observer, at: 2026-08-27T10:00:00Z }
verified:
  - { by: probe:multi-turn-response-repetition-local-20260827, at: 2026-08-27T10:00:00Z }
status: experimental
stale_after: 2026-09-10T10:00:00Z
sources:
  - id: subject
    resource: ../../tools/multi-turn-response-repetition-observer.md
    title: 多轮回复重复观测器
    author: tool:multi-turn-response-repetition-observer
  - id: see-2019
    resource: https://aclanthology.org/N19-1170/
    title: What makes a good conversation?
    author: research:see-et-al-2019
  - id: han-2022
    resource: https://aclanthology.org/2022.findings-emnlp.66/
    title: On the Role of Diversity in Conversational Models
    author: research:han-et-al-2022
  - id: groundialog
    resource: https://aclanthology.org/2023.bea-1.26/
    title: GrounDialog Repair and Grounding in Task-oriented Dialogues
    author: research:kontogiorgos-et-al-2023
  - id: local-report
    resource: ../../verifications/assistant/multi-turn-response-repetition/report.json
    title: Multi-turn response repetition local verification
    author: probe:multi-turn-response-repetition-local
capability:
  id: assistant.observe-multi-turn-response-repetition
  version: 1.0.0
  subjectRef: /tools/multi-turn-response-repetition-observer.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/observe-multi-turn-response-repetition-input.schema.json
  outputSchema: /schemas/assistant/observe-multi-turn-response-repetition-output.schema.json
  resultConcepts: [/concepts/assistant/multi-turn-response-repetition-observation-suite.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 调用方提供并授权处理有界助手回复。原文只在观测期存在；结果仅含摘要、定位符和词法计数。能力不读取平台或身份数据，不改变 Persona 或记忆，不执行动作，也不授予授权。
verification:
  level: local
  report: /verifications/assistant/multi-turn-response-repetition/report.json
---

# 观测多轮助手回复重复

对给定的多轮助手回复，返回规范化后完全相同的历史回复 locator，以及当前 2/3-gram 在此前助手回复中出现的数量和比例。确认复述、按请求重复、纠错、安全边界与口头禅可以携带证据声明，但不删除原始观测。

当前中英文 fixture 已通过本地真实运行、输入/输出 Schema、无原文留存和零副作用检查。该能力只证明确定性词法观测可工作；它不识别同义反复，不提供阈值或质量分，也不能推断 Persona 连续性或长期陪伴效果，因此要求人工结合场景解释。

- [输入 Schema](../../schemas/assistant/observe-multi-turn-response-repetition-input.schema.json)
- [输出 Schema](../../schemas/assistant/observe-multi-turn-response-repetition-output.schema.json)
- [验证报告](../../verifications/assistant/multi-turn-response-repetition/report.json)

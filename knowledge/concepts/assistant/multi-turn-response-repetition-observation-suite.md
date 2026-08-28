---
type: Concept
title: Multi-turn Response Repetition Observation Suite
description: 将有界多轮助手回复、locale、调用方声明的重复上下文和逐轮词法重叠结果绑定为可复核观测对象。
tags: [assistant, pet, dialogue, repetition, ngram, observation-suite]
generated: { by: connector:multi-turn-response-repetition-observer, at: 2026-08-27T10:00:00Z }
verified:
  - { by: probe:multi-turn-response-repetition-local-20260827, at: 2026-08-27T10:00:00Z }
status: experimental
stale_after: 2026-09-10T10:00:00Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/multi-turn-response-repetition/snapshot.json
    title: Verified multilingual repetition observation fixture
    author: connector:multi-turn-response-repetition-observer
---

# Multi-turn Response Repetition Observation Suite

一个 Suite 包含 1–12 个互相隔离的 case；每个 case 固定 locale、2–20 条有序助手回复，以及可选的调用方声明重复语境。比较范围严格限定为同一 case 内当前回复之前的助手回复。

Suite 分开保存三类事实：规范化后完全相同的 prior locator、2-gram 重叠、3-gram 重叠。过短文本明确返回 `unavailable`，第一轮返回 `no-history`，不会用零分掩盖不可比较状态。

确认复述、纠错或角色口头禅可能是合理重复，因此语境声明会保留；但它只是调用方证据，不是自动免责。词法指标也不能覆盖同义改写，不能单独解释好坏，更不能推断 Persona 连续性、依恋、健康、留存或长期陪伴结果。

- [输出 Schema](../../schemas/assistant/observe-multi-turn-response-repetition-output.schema.json)
- [验证快照](../../verifications/assistant/multi-turn-response-repetition/snapshot.json)

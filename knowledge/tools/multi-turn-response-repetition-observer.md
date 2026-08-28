---
type: Tool
title: 多轮回复重复观测器
description: 对有界多轮助手回复执行确定性的规范化原样重复与 2/3-gram 历史重叠观测。
tags: [assistant, pet, dialogue, repetition, lexical-observation, human-review]
generated: { by: connector:multi-turn-response-repetition-observer, at: 2026-08-27T10:00:00Z }
verified:
  - { by: probe:multi-turn-response-repetition-local-20260827, at: 2026-08-27T10:00:00Z }
status: experimental
stale_after: 2026-09-10T10:00:00Z
sources:
  - id: controllable-dialogue
    resource: https://github.com/facebookresearch/ParlAI/blob/38fce64bc0ad7d0e676316b3b52407541e624680/projects/controllable_dialogue/controllable_seq2seq/controls.py
    title: ParlAI controllable dialogue repetition controls
    author: project:parlai
  - id: local-verification
    resource: ../verifications/assistant/multi-turn-response-repetition/report.json
    title: Multi-turn response repetition local verification
    author: probe:multi-turn-response-repetition-local
---

# 多轮回复重复观测器

工具接收按 case 分组、顺序固定的助手回复，使用声明 locale 的 `Intl.Segmenter`、NFKC 和小写规范化，返回每条回复与此前助手回复的原样重复引用及 2/3-gram 重叠计数。

调用方可以声明确认复述、按请求重复、纠错、安全边界或 persona 口头禅等上下文，但这些声明只保留 provenance，不会删掉原始重复。输出不设阈值、不产生质量分，也不判断语义重复、Persona 连续性或陪伴效果。

输入文本只在调用期处理；持久输出仅保留摘要、locator 和计数。当前本地 probe 验证中英文 fixture、Schema、确定性与零副作用；跨语言语义重复和真实长期对话效果仍未验证。

- [能力](../capabilities/assistant/observe-multi-turn-response-repetition.md)
- [观测 Suite](../concepts/assistant/multi-turn-response-repetition-observation-suite.md)

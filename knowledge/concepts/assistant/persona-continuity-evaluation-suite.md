---
type: Concept
title: Persona Continuity Evaluation Suite
description: 将冻结 persona 规则、七类候选响应情境、多 evaluator 逐轴观察与系统事实判断绑定为内容寻址的待人审评测对象。
tags: [assistant, pet, persona, continuity, evaluation-suite, system-truth]
generated: { by: connector:persona-continuity-evaluator, at: 2026-08-27T08:23:39.488Z }
verified:
  - { by: probe:persona-continuity-evaluation-local-20260827, at: 2026-08-27T08:23:39.488Z }
status: experimental
stale_after: 2026-09-10T08:23:39.488Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/persona-continuity-evaluation/snapshot.json
    title: Verified seven-scenario persona continuity contract fixture
    author: connector:persona-continuity-evaluator
---

# Persona Continuity Evaluation Suite

一个 Suite 把 persona revision、四类规则和最多 20 个 case 冻结在一起。Case 可以覆盖干净行为、合法更新、对抗覆盖、寻求附和、情绪脆弱、系统状态冲突和上下文不足；输出只保留 case、rule、response segment、truth 的 locator 与内容摘要。

连续性不是单一“像不像这个角色”的分数：

- `role` 判断承担的身份和职责；
- `boundary` 判断不能越过的行为边界；
- `value` 判断用户自主性等价值约束；
- `style` 判断交流表现；
- `systemTruth` 独立判断响应是否与真实执行状态冲突。

每个 verdict 都带 evaluator provenance。不同 judge 不一致就是 `disagreement`，证据不足就是 `unknown`。Suite 不包含轨迹记忆、重复度、用户依恋、健康或留存指标，也不据此推断长期陪伴质量。

- [输出 Schema](../../schemas/assistant/evaluate-persona-continuity-suite-output.schema.json)
- [验证快照](../../verifications/assistant/persona-continuity-evaluation/snapshot.json)

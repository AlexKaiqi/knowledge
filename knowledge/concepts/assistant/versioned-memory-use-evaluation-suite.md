---
type: Concept
title: Versioned Memory Use Evaluation Suite
description: 由显式记忆演进图、目标字段、标准化 observed trace 与分阶段评测结果组成的内容寻址测试套件。
tags: [assistant, memory, evaluation-suite, supersession, abstention, utilization]
generated: { by: connector:versioned-memory-use-evaluator, at: 2026-08-27T07:25:55Z }
verified:
  - { by: probe:versioned-memory-use-evaluation-local-20260827, at: 2026-08-27T07:25:55Z }
status: stable
stale_after: 2026-09-26T07:25:55Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/versioned-memory-use-evaluation/snapshot.json
    title: Verified ten-case versioned memory use suite
    author: connector:versioned-memory-use-evaluator
---

# Versioned Memory Use Evaluation Suite

一个 Suite 包含 1–50 个独立 case。每个 case 只有显式生命周期元数据和摘要，不含 transcript、自然语言答案、真实身份或内部 route。`confirmed` 记录可提供当前值；`revoked` 明确取消被引用版本；`contested` 保留不确定性；跨 scope、未生效和过期记录不能成为当前值。

对于 recall，必需事实未知或未决时应 `abstain`；对于 action parameters，应 `ask`。显式当前输入优先于记忆，但不会静默改写长期记忆。结果 digest 绑定 fixture revision、全部 case、expected/observed trace 和阶段结论，同时固定 `memoryChanged=false`、`knowledgeWritten=false`、`actionExecuted=false`、`executionAuthorized=false`。

- [输出 Schema](../../schemas/assistant/evaluate-versioned-memory-use-suite-output.schema.json)
- [验证快照](../../verifications/assistant/versioned-memory-use-evaluation/snapshot.json)

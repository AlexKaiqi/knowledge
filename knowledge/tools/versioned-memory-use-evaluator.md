---
type: Tool
title: 版本化记忆使用评测器
description: 从显式版本、撤销、争议、过期和 scope 图派生 fixture 真值，分阶段评测标准化记忆使用 trace。
tags: [assistant, memory, evaluation, versioning, abstention, provenance, deterministic]
generated: { by: connector:versioned-memory-use-evaluator, at: 2026-08-27T07:25:55Z }
verified:
  - { by: probe:versioned-memory-use-evaluation-local-20260827, at: 2026-08-27T07:25:55Z }
status: stable
stale_after: 2026-09-26T07:25:55Z
sources:
  - id: research-dossier
    resource: ../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json
    title: Personal assistant memory academic-frontier dossier
    author: connector:evidence-backed-research-agent
  - id: local-verification
    resource: ../verifications/assistant/versioned-memory-use-evaluation/report.json
    title: Versioned memory use evaluation local verification
    author: probe:versioned-memory-use-evaluation-local
---

# 版本化记忆使用评测器

工具不连接某个 memory backend，而是评测调用方提供的标准化 trace。Fixture 用 opaque memory/fact/field/scope refs、SHA-256、明确的 `supersedesRefs`、confirmed/contested/revoked、有效时间和过期时间描述记忆演进；评测器不从“时间戳最新”猜当前事实。

每个 case 分别给出 ingestion、retrieval、版本与 scope 解析、abstention/action decision、evidence-grounded utilization 五个结果。通过只表示该 trace 与这个冻结 fixture 的派生真值一致，不证明被评系统在其它任务、真实用户或完整 benchmark 上可靠。

- [能力](../capabilities/assistant/evaluate-versioned-memory-use-suite.md)
- [Evaluation Suite 概念](../concepts/assistant/versioned-memory-use-evaluation-suite.md)

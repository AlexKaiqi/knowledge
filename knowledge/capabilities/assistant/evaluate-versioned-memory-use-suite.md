---
type: Capability
title: 评测版本化记忆使用 Suite
description: 对标准化记忆系统 trace 执行确定性的 ingestion、retrieval、版本/scope、abstention 与 utilization 分阶段评测。
tags: [assistant, memory, evaluation, versioning, abstention, safety]
outcomes: [product-research]
generated: { by: connector:versioned-memory-use-evaluator, at: 2026-08-27T07:25:55Z }
verified:
  - { by: probe:versioned-memory-use-evaluation-local-20260827, at: 2026-08-27T07:25:55Z }
status: stable
stale_after: 2026-09-26T07:25:55Z
sources:
  - id: subject
    resource: ../../tools/versioned-memory-use-evaluator.md
    title: 版本化记忆使用评测器
    author: tool:versioned-memory-use-evaluator
  - id: evermem
    resource: https://arxiv.org/html/2602.01313
    title: Evaluating Long-Horizon Memory for Multi-Party Collaborative Dialogues
    author: paper:arxiv-2602.01313v3
  - id: longmemeval
    resource: https://arxiv.org/html/2410.10813
    title: LongMemEval
    author: paper:arxiv-2410.10813v2
  - id: mem2act
    resource: https://arxiv.org/html/2601.19935
    title: Mem2ActBench
    author: paper:arxiv-2601.19935v1
  - id: ifcmemorybench
    resource: https://arxiv.org/html/2607.26072
    title: IFCMemoryBench
    author: paper:arxiv-2607.26072v1
  - id: local-report
    resource: ../../verifications/assistant/versioned-memory-use-evaluation/report.json
    title: Versioned memory use evaluation local verification
    author: probe:versioned-memory-use-evaluation-local
capability:
  id: assistant.evaluate-versioned-memory-use-suite
  version: 1.0.0
  subjectRef: /tools/versioned-memory-use-evaluator.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/evaluate-versioned-memory-use-suite-input.schema.json
  outputSchema: /schemas/assistant/evaluate-versioned-memory-use-suite-output.schema.json
  resultConcepts: [/concepts/assistant/versioned-memory-use-evaluation-suite.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只允许 opaque refs、摘要、显式生命周期/版本/scope 元数据和标准化 observed trace。能力不读取 transcript 或真实身份，不调用模型或 memory backend，不改变记忆、不写知识、不执行动作，也不产生授权。
verification:
  level: local
  report: /verifications/assistant/versioned-memory-use-evaluation/report.json
---

# 评测版本化记忆使用 Suite

调用者提供冻结的记忆记录图、当前 scope/时间、待解析字段和候选系统的标准化 trace。能力从显式 supersession/revocation/contest/expiry 关系派生当前真值，拒绝用“最后写入”代替版本语义。

输出分开评测五个阶段：

1. 必要历史是否进入 ingestion，且没有跨 scope 记录；
2. retrieval 是否覆盖当前 head/revocation/contest，同时没有旧版本或相似干扰；
3. selected evidence 是否匹配当前版本或未决诊断集合；
4. recall 未知时是否 abstain、action 参数缺失时是否 ask；
5. 输出字段的 digest 和 evidence 是否精确匹配。

local probe 的十类 fixture 覆盖已确认偏好、当前显式覆盖、时间 supersession、未决冲突、必需事实缺失、相似无关记忆、scope 隔离、过期、撤销和争议。另行 mutation 证明旧版本、跨 scope 和 unsupported autofill 会命中不同阶段。

该能力只评测 trace，不运行被评系统。Suite 通过不等于某个 memory backend、模型、个人助理或陪伴产品已经通过端到端验证。

- [输入 Schema](../../schemas/assistant/evaluate-versioned-memory-use-suite-input.schema.json)
- [输出 Schema](../../schemas/assistant/evaluate-versioned-memory-use-suite-output.schema.json)
- [验证报告](../../verifications/assistant/versioned-memory-use-evaluation/report.json)

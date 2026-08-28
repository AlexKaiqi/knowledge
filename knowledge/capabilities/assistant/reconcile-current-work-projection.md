---
type: Capability
title: 对账当前工作投影
description: 从最近持久 Session 的各自游标后串行处理未消费增量，恢复进程停止或离线期间遗漏的 current-work 投影更新。
tags: [assistant, current-work, reconciliation, crash-recovery, session-history]
outcomes: [product-research]
generated: { by: connector:current-work-projection-reconciler, at: 2026-08-27T10:42:18.400Z }
verified:
  - { by: probe:current-work-projection-reconciliation-local-20260827, at: 2026-08-27T10:42:18.400Z }
status: experimental
stale_after: 2026-09-26T10:42:18.400Z
sources:
  - id: subject
    resource: ../../tools/current-work-projection-reconciler.md
    title: 当前工作投影对账器
    author: tool:current-work-projection-reconciler
  - id: production-maintainer
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/maintainer.js
    title: Personal Knowledge production maintainer
    author: organization:AlexKaiqi
  - id: production-service
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Personal Knowledge production service
    author: organization:AlexKaiqi
  - id: production-evidence
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/eval/evidence/latest.md
    title: Personal Knowledge production E2E evidence
    author: organization:AlexKaiqi
  - id: local-report
    resource: ../../verifications/assistant/current-work-projection-reconciliation/report.json
    title: Current work projection reconciliation local verification
    author: probe:current-work-projection-reconciliation-local
capability:
  id: assistant.reconcile-current-work-projection
  version: 1.0.0
  subjectRef: /tools/current-work-projection-reconciler.md
  kind: computation
  effect: local-write
  inputSchema: /schemas/assistant/reconcile-current-work-projection-input.schema.json
  outputSchema: /schemas/assistant/reconcile-current-work-projection-output.schema.json
  resultConcepts: [/concepts/assistant/current-work-projection-reconciliation.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: optional
    agentInvolvement: required
access:
  class: owned
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只能由 owner-bound Workspace/Session runtime 调用，当前 Session 必须排除。模型只接收生产 Maintainer 选择的有界未消费 Session 增量；公共结果不返回正文、cwd、cursor 数值、模型 route 或私有根路径。current.md 与 cursor 是可重建运行态；长期知识候选只生成未确认 proposal，不 apply、不 commit。该能力不能清空 cursor、执行全量重建、修改 Session 历史或授权动作。
verification:
  level: local
  report: /verifications/assistant/current-work-projection-reconciliation/report.json
---

# 对账当前工作投影

该能力补的是“进程停止或离线期间漏处理了 Session 增量”，不是重新总结全部历史。生产 Maintainer 最多枚举最近 12 个持久 Session，排除当前 Session，按旧到新读取每个 Session 自己的 cursor 之后的语义事件，串行更新同一个 `.pkb/current.md`，再推进对应 cursor。精确重放不会再次调用模型。

隔离 probe 直接组合固定 production revision：两个持久 Session 依次更新真实 current 文件和各自 cursor；第二个 Session 的模型调用中断后，第一个 Session 已写入的 current/cursor 保留，下一次运行因 cursor 跳过它，只恢复剩余 Session。生成的一条长期知识候选停留在 proposal，`knowledge/` 和 Git HEAD 未变化。

边界必须如实保留：生产实现只看最近 12 个 Session，`listEvents` 或 `filterEvents` 失败会跳过且当前返回值不能完整列出失败来源。因此输出固定 `sessionEnumerationComplete=false` 和 `sourceFailuresFullyObservable=false`。它也不会删除或重置 cursor，所以 `fullProjectionRebuild=false`、`cursorReset=false`；当前文件损坏、游标丢失或需要从全部历史重建仍是另一项未完成能力。

- [输入 Schema](../../schemas/assistant/reconcile-current-work-projection-input.schema.json)
- [输出 Schema](../../schemas/assistant/reconcile-current-work-projection-output.schema.json)
- [验证报告](../../verifications/assistant/current-work-projection-reconciliation/report.json)

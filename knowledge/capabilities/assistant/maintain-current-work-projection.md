---
type: Capability
title: 维护当前工作投影
description: 从 owner-bound 当前 Session 的未消费增量更新可重建 current、推进 checkpoint，并仅生成未确认长期知识 proposal。
tags: [personal-assistant, current-work, session, agent, checkpoint, proposal, local-write]
outcomes: [product-research]
generated: { by: connector:current-work-projection-maintainer, at: 2026-08-27T06:49:31Z }
verified:
  - { by: probe:current-work-projection-maintenance-local-20260827, at: 2026-08-27T06:49:31Z }
status: experimental
stale_after: 2026-09-26T06:49:31Z
sources:
  - id: subject
    resource: ../../tools/current-work-projection-maintainer.md
    title: 当前工作投影维护器
    author: tool:current-work-projection-maintainer
  - id: production-maintainer
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/maintainer.js
    title: Production current-work maintenance implementation
    author: organization:alex-kaiqi
  - id: production-e2e
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/eval/evidence/latest.md
    title: Production Personal Knowledge E2E evidence
    author: project:dsh-personal-knowledge-base
  - id: local-report
    resource: ../../verifications/assistant/current-work-projection-maintenance/report.json
    title: Local verification report
    author: probe:current-work-projection-maintenance-local
capability:
  id: assistant.maintain-current-work-projection
  version: 1.0.0
  subjectRef: /tools/current-work-projection-maintainer.md
  kind: operation
  effect: local-write
  inputSchema: /schemas/assistant/maintain-current-work-projection-input.schema.json
  outputSchema: /schemas/assistant/maintain-current-work-projection-output.schema.json
  resultConcepts: [/concepts/assistant/current-work-projection-maintenance.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: optional
    agentInvolvement: required
access:
  class: owned
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 可信运行时必须把当前 Session 与 Workspace 绑定到同一 owner。调用者明确接受最多四个未确认 proposal；不得提交 transcript、真实 cwd、cursor、模型 route、proposal 正文、confirmation 或 authority。current/cursor/proposal 是本地运行态；proposal 仍须独立人审和真实主人确认才能 apply。
verification:
  level: local
  report: /verifications/assistant/current-work-projection-maintenance/report.json
---

# 维护当前工作投影

这条能力与“读取有界工作上下文”分开：本能力只维护状态并返回 mutation facts，不返回生成的 current Markdown；读取能力再按 query 和字符预算提供瞬时上下文。

本地 probe 加载固定生产 `KnowledgeMaintainer` 和 `PersonalKnowledgeBase`：在隔离 Git 仓库读取当前 Session 两条未消费 message events，真实原子写入 current、写入 cursor，并创建一个未确认 proposal。proposal 未 apply，`knowledge/*.md` 仍为空，Git HEAD 不变；相同 Session 无新事件再次运行时返回 `no-new-session-text`，模型调用次数仍为一次。

生产 E2E 还证明真实模型组合可以保留瞬时 current、阻止未确认候选提交，并在 blocker 被解决后收敛状态。但当前 local probe 的模型输出是受控夹具，尚未覆盖模型 route 变化、并发多 Session、进程崩溃恢复和跨入口 owner resolution，因此保持 experimental，且 `modelOutputHumanReviewed=false`、`currentProjectionComplete=false`。

- [输入 Schema](../../schemas/assistant/maintain-current-work-projection-input.schema.json)
- [输出 Schema](../../schemas/assistant/maintain-current-work-projection-output.schema.json)
- [验证报告](../../verifications/assistant/current-work-projection-maintenance/report.json)

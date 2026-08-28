---
type: Capability
title: 投影公开状态为宠物行为
description: 将有界、按时间排序的公开 Session/Pet Assistant 状态轨迹投影为确定性的宠物行为 baseline 与一次性 pulse。
tags: [personal-assistant, pet, task-state, behavior, privacy, deterministic]
outcomes: [product-research]
generated: { by: connector:public-state-pet-behavior-projector, at: 2026-08-27T02:01:44Z }
verified:
  - { by: probe:public-state-pet-behavior-local-20260827, at: 2026-08-27T02:01:44Z }
status: stable
stale_after: 2026-09-26T02:01:44Z
sources:
  - id: subject
    resource: ../../tools/public-state-pet-behavior-projector.md
    title: 公开状态宠物行为投影器
    author: tool:public-state-pet-behavior-projector
  - id: production-implementation
    resource: https://github.com/AlexKaiqi/dsh-codex-pet/blob/ddacb3e40385db280930e93d350d3706a8656518/packages/dsh-codex-pet/lib/client.js
    title: dsh-codex-pet production client
    author: organization:alex-kaiqi
  - id: local-report
    resource: ../../verifications/pet/public-state-behavior/report.json
    title: Local verification report
    author: probe:public-state-pet-behavior-local
capability:
  id: pet.project-public-state-to-behavior
  version: 1.0.0
  subjectRef: /tools/public-state-pet-behavior-projector.md
  kind: computation
  effect: none
  inputSchema: /schemas/pet/project-public-state-to-behavior-input.schema.json
  outputSchema: /schemas/pet/project-public-state-to-behavior-output.schema.json
  resultConcepts: [/concepts/pet/public-state-behavior-plan.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只接受公开生命周期状态和 opaque Session ID；不得提供 transcript、prompt、工具参数、隐藏推理、凭据或 Provider 状态。能力无外部通信和平台写入。
verification:
  level: local
  report: /verifications/pet/public-state-behavior/report.json
---

# 投影公开状态为宠物行为

输入是一段最多 100 个事件、按 `atMs` 排序的公开状态轨迹。Session 快照最多包含 50 个 opaque Session ID、`running`、`pendingInteraction` 和有界 job status；Pet Assistant 事件只包含 `available`、公开 `status` 与公开 `phase`。

输出为逐事件行为决定：`idle|running` 是持续 loop baseline；等待确认、任务完成、失败、助手说话/编辑/就绪等变化生成一次性 pulse。首次 Session 快照只建立边沿，避免订阅时把旧等待或旧失败当成新事件。相同输入必得相同结果和 digest。

当前验证从固定生产提交读取原实现，核对运行、等待、完成、失败与助手状态映射，并对混合轨迹执行两次重放；输出 Schema、优先级、私有字段拒绝和隐藏执行边界均通过。验证没有证明 UI 已挂载、精灵资产可用、动画帧正确、语音链路成立或长期陪伴有效，这些分别属于产品装配、渲染、Realtime 和纵向用户研究。

- [输入 Schema](../../schemas/pet/project-public-state-to-behavior-input.schema.json)
- [输出 Schema](../../schemas/pet/project-public-state-to-behavior-output.schema.json)
- [验证报告](../../verifications/pet/public-state-behavior/report.json)

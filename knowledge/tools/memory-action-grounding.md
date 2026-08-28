---
type: Tool
title: 记忆到动作参数绑定器
description: 将有 provenance 的确认记忆按 action、scope 和字段策略绑定为可审阅的动作候选参数，不执行也不授权动作。
tags: [personal-assistant, memory, action, grounding, provenance, conflict, safety]
generated: { by: connector:memory-action-grounding, at: 2026-08-27T02:11:29Z }
verified:
  - { by: probe:memory-action-grounding-local-20260827, at: 2026-08-27T02:11:29Z }
status: stable
stale_after: 2026-09-26T02:11:29Z
sources:
  - id: personal-knowledge
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js
    title: Personal Knowledge projection implementation
    author: organization:alex-kaiqi
  - id: pet-assistant
    resource: https://github.com/AlexKaiqi/dsh-pet-assistant/blob/77ea504f5267ac0f929d4fc81301f999899f270b/dsh/core.js
    title: Pet Assistant knowledge and delegation boundary
    author: organization:alex-kaiqi
  - id: memtoolagent
    resource: https://arxiv.org/abs/2606.07909v1
    title: MemToolAgent
    author: paper:2606.07909
  - id: stale
    resource: https://arxiv.org/abs/2605.06527v1
    title: STALE
    author: paper:2605.06527
  - id: tangle
    resource: https://arxiv.org/abs/2608.13921v1
    title: TANGLE
    author: paper:2608.13921
  - id: local-verification
    resource: ../verifications/assistant/memory-action-grounding/report.json
    title: Memory-action grounding local verification
    author: probe:memory-action-grounding-local
---

# 记忆到动作参数绑定器

这个本地工具解决一个窄问题：本轮明确参数和已经结构化、带 provenance 的记忆，究竟可以填入 action 的哪些字段。它按字段声明 `explicit-only`、`allow-user-confirmed` 或 `allow-confirmed-or-verified`，只接受 exact action、exact scope、active、未过期且类型正确的 claim。

结果保留每个字段的来源、claim ID 和 provenance；冲突、过期、未确认、被争议或错误 scope 的记忆都留空并给出原因。输出即使 `readiness=grounded`，`executionAuthorized` 也永远为 `false`。

它不解析个人知识 Markdown、不调用模型、不执行工具、不创建提醒，也不替代授权、幂等执行或 receipt 对账。这样调用者不需要知道内部 Connector，但也不能把“参数已绑定”误解成“用户已经允许执行”。

- [绑定记忆为动作候选](../capabilities/assistant/ground-memory-into-action-candidate.md)
- [Memory-grounded Action Candidate](../concepts/assistant/memory-grounded-action-candidate.md)

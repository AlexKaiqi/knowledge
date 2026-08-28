---
type: Tool
title: 公开状态宠物行为投影器
description: 把公开 Session 与 Pet Assistant 生命周期状态投影为渲染器无关、可确定性重放的宠物 baseline 与一次性动作。
tags: [personal-assistant, pet, task-state, behavior, projection, privacy]
generated: { by: connector:public-state-pet-behavior-projector, at: 2026-08-27T02:01:44Z }
verified:
  - { by: probe:public-state-pet-behavior-local-20260827, at: 2026-08-27T02:01:44Z }
status: stable
stale_after: 2026-09-26T02:01:44Z
sources:
  - id: production-implementation
    resource: https://github.com/AlexKaiqi/dsh-codex-pet/blob/ddacb3e40385db280930e93d350d3706a8656518/packages/dsh-codex-pet/lib/client.js
    title: dsh-codex-pet production client
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/pet/public-state-behavior/report.json
    title: Public-state pet behavior local verification
    author: probe:public-state-pet-behavior-local
---

# 公开状态宠物行为投影器

这是一个无账号、无副作用的本地投影工具。它只消费五类公开状态：Session 是否运行、是否等待交互、job 状态、Pet Assistant status 和 phase；输出持续 baseline 与可选的一次性 pulse。渲染器、精灵图、角色 Rig、DSH runtime 对象和事件通道都不属于公共结果。

它刻意不接收 transcript、prompt、工具参数、隐藏推理、凭据或 Provider 状态。首次 Session 快照只建立边沿，不重播在订阅前已经存在的等待或失败状态。失败、等待确认、任务完成和助手生命周期使用明确优先级与原因码，调用者可以稳定重放并替换渲染实现。

当前语义来自 `dsh-codex-pet` 已提交的生产客户端；未提交的 Character C0、连续情绪、长期陪伴效果与角色心理模型没有被吸收。Collector 观察固定提交、`main` 漂移和本地验证时效，变化只生成 review proposal。

- [投影公开状态为宠物行为](../capabilities/pet/project-public-state-to-behavior.md)
- [公开状态宠物行为计划](../concepts/pet/public-state-behavior-plan.md)

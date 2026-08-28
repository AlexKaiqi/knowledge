---
type: Concept
title: 公开状态宠物行为计划
description: 对一段公开状态轨迹逐事件给出的持续 baseline、一次性 pulse、优先级、原因与覆盖边界。
tags: [pet, behavior-plan, baseline, pulse, public-state, deterministic]
generated: { by: connector:public-state-pet-behavior-projector, at: 2026-08-27T02:01:44Z }
verified:
  - { by: probe:public-state-pet-behavior-local-20260827, at: 2026-08-27T02:01:44Z }
status: stable
stale_after: 2026-09-26T02:01:44Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/pet/public-state-behavior/snapshot.json
    title: Verified public-state pet behavior plan
    author: connector:public-state-pet-behavior-projector
---

# 公开状态宠物行为计划

`baseline` 是持续状态，只允许 `idle|running` 且播放模式为 `loop`。`pulse` 是由状态边沿触发的一次性动作，允许 `waiting|review|failed|waving|jumping`，并附稳定优先级和原因；没有边沿时为 `null`。

计划描述“应表达什么”，不规定用精灵图、SVG、3D Rig、声音还是实体设备表现，也不声称知道 Agent 的情绪或思考内容。`task-finished` 只表示观测到 Session 从 running 变为非 running；`job-failed` 只表示公开 job status 出现失败，不推断根因。

`coverage.privateTextAccepted=false` 是契约边界：宠物行为投影不需要聊天正文、隐藏推理或工具参数。若产品要显示助手公开 transcript，那是独立 UI 数据流，不能借本计划扩大状态输入。

- [输出 Schema](../../schemas/pet/project-public-state-to-behavior-output.schema.json)
- [验证样本](../../verifications/pet/public-state-behavior/snapshot.json)

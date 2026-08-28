---
type: Tool
title: 双工轮次策略投影器
description: 对 normalized duplex event trace 做确定性状态机投影，在候选确认前保持可逆，并隔离真实音频与播放副作用。
tags: [personal-assistant, voice, turn-taking, barge-in, deterministic, privacy]
generated: { by: connector:duplex-turn-policy-projector, at: 2026-08-27T06:05:04Z }
verified:
  - { by: probe:duplex-turn-policy-local-20260827, at: 2026-08-27T06:05:04Z }
status: stable
stale_after: 2026-09-10T06:05:04Z
sources:
  - id: production-implementation
    resource: https://github.com/AlexKaiqi/dsh-realtime-voice/blob/1cfddba6ad39d4b8ef075b66870ab533068a7d78/client/client.js
    title: dsh-realtime-voice production client
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/voice/duplex-turn-policy/report.json
    title: Duplex turn policy local verification
    author: probe:duplex-turn-policy-local
---

# 双工轮次策略投影器

这是无账号、无副作用的本地工具。它把候选开始、候选释放、候选分类、助手输出边界和用户轮次结束投影为动作计划。候选期间只降音；误触或 backchannel 都可恢复；`cancel-output` 只在确认抢轮时出现。

工具只消费控制面事件，不消费音频或话语内容，也不会调用实际语音运行时。调用方必须单独证明自己的事件分类质量，并决定是否把计划交给有播放与 Provider 权限的执行层。

- [能力](../capabilities/voice/project-duplex-turn-events-to-actions.md)
- [计划概念](../concepts/voice/reversible-duplex-turn-plan.md)

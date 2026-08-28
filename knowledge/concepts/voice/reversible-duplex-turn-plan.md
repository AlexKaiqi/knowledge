---
type: Concept
title: 可逆双工轮次计划
description: 在候选语音确认前只允许可恢复降音，确认后才区分短反馈保持与真实抢轮取消的有界动作计划。
tags: [voice, full-duplex, turn-taking, reversible, backchannel, barge-in]
generated: { by: connector:duplex-turn-policy-projector, at: 2026-08-27T06:05:04Z }
verified:
  - { by: probe:duplex-turn-policy-local-20260827, at: 2026-08-27T06:05:04Z }
status: stable
stale_after: 2026-09-10T06:05:04Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/voice/duplex-turn-policy/snapshot.json
    title: Verified reversible duplex turn plan
    author: connector:duplex-turn-policy-projector
---

# 可逆双工轮次计划

计划把“检测到一些像人声的输入”和“确定用户要拿走轮次”分开：

- `duck-output` 是候选期的可逆动作；它不能丢弃播放缓冲或取消模型响应。
- `restore-output` 用于候选释放或 backchannel，恢复候选前输出。
- `record-backchannel` 表示短反馈已经分类，但不取得说话权。
- `cancel-output` 只允许出现在 `take-turn` 确认后；随后 `open-user-turn`。
- `commit-user-turn` 只在已经打开的用户轮次结束时出现。

`latencyMs` 只是冻结事件之间的观察差，不证明任何 VAD 的真实设备延迟。分类错误、环境噪声、语言差异和多人重叠语音仍需独立音频评测。

- [输出 Schema](../../schemas/voice/project-duplex-turn-events-to-actions-output.schema.json)
- [验证快照](../../verifications/voice/duplex-turn-policy/snapshot.json)

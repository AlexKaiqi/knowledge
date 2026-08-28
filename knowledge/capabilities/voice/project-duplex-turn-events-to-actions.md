---
type: Capability
title: 将双工轮次事件投影为可逆动作
description: 将有界、按时间排序且不含音频正文的双工事件轨迹投影为候选降音、误触恢复、短反馈保持、确认打断与用户轮次提交动作。
tags: [personal-assistant, voice, full-duplex, turn-taking, barge-in, reversible]
outcomes: [product-research]
generated: { by: connector:duplex-turn-policy-projector, at: 2026-08-27T06:05:04Z }
verified:
  - { by: probe:duplex-turn-policy-local-20260827, at: 2026-08-27T06:05:04Z }
status: stable
stale_after: 2026-09-10T06:05:04Z
sources:
  - id: subject
    resource: ../../tools/duplex-turn-policy-projector.md
    title: 双工轮次策略投影器
    author: tool:duplex-turn-policy-projector
  - id: production-implementation
    resource: https://github.com/AlexKaiqi/dsh-realtime-voice/blob/1cfddba6ad39d4b8ef075b66870ab533068a7d78/client/client.js
    title: dsh-realtime-voice production client
    author: organization:alex-kaiqi
  - id: problem-evidence
    resource: https://github.com/huggingface/speech-to-speech/issues/433
    title: Reversible pre-confirmation audio ducking
    author: organization:hugging-face
  - id: benchmark
    resource: https://arxiv.org/abs/2607.20460
    title: Instruct-FD full-duplex instruction-following benchmark
    author: source:arxiv
  - id: local-report
    resource: ../../verifications/voice/duplex-turn-policy/report.json
    title: Local verification report
    author: probe:duplex-turn-policy-local
capability:
  id: voice.project-duplex-turn-events-to-actions
  version: 1.0.0
  subjectRef: /tools/duplex-turn-policy-projector.md
  kind: computation
  effect: none
  inputSchema: /schemas/voice/project-duplex-turn-events-to-actions-input.schema.json
  outputSchema: /schemas/voice/project-duplex-turn-events-to-actions-output.schema.json
  resultConcepts: [/concepts/voice/reversible-duplex-turn-plan.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只接受 normalized event、时间戳、opaque candidate ID 与 take-turn/backchannel 分类；拒绝 raw audio、transcript、prompt、凭据和 Provider wire event。能力只生成动作计划，不执行播放控制或响应取消。
verification:
  level: local
  report: /verifications/voice/duplex-turn-policy/report.json
---

# 将双工轮次事件投影为可逆动作

输入是一段最多 200 个 normalized events。候选语音开始时，如果助手仍在输出，只生成可恢复的 `duck-output`；候选释放时恢复输出。确认是 `backchannel` 时恢复输出并记录短反馈，不抢占轮次；只有确认是 `take-turn` 时才生成 `cancel-output` 与 `open-user-turn`。用户轮次结束后生成 `commit-user-turn`。

能力拒绝 raw audio 与 transcript，也不实现 VAD、声学分类、麦克风、播放、Provider 连接或真正取消响应。它解决的是“在已经有 normalized event 的情况下，哪些状态转移允许升级为不可逆动作”，不是识别模型本身。

当前验证覆盖噪声误触、短反馈、384ms 后确认抢话、输出空闲时的自然开轮次、乱序/重叠/迟到/未闭合事件拒绝，以及固定输入确定性重放。生产实现证据显示现有运行时在 `speech_started` 时直接停止播放并发送 `response.cancel`；本能力因此是可验证的策略切片，不代表现有语音产品已经采用它。

- [输入 Schema](../../schemas/voice/project-duplex-turn-events-to-actions-input.schema.json)
- [输出 Schema](../../schemas/voice/project-duplex-turn-events-to-actions-output.schema.json)
- [验证报告](../../verifications/voice/duplex-turn-policy/report.json)

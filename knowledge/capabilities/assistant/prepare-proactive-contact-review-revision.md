---
type: Capability
title: 准备主动联系审阅 Revision
description: 在不发送通知的前提下，用主人控制、静默期、近期活动、频控、未回复、去重和有效期筛选并冻结一项主动联系候选。
tags: [personal-assistant, proactive, reminder, follow-up, quiet-hours, opt-in, review]
outcomes: [product-research]
generated: { by: connector:proactive-contact-review-revision, at: 2026-08-27T04:28:03Z }
verified:
  - { by: probe:proactive-contact-review-revision-local-20260827, at: 2026-08-27T04:28:03Z }
status: stable
stale_after: 2026-09-26T04:28:03Z
sources:
  - id: subject
    resource: ../../tools/proactive-contact-review-revision.md
    title: 主动联系审阅 Revision 准备器
    author: tool:proactive-contact-review-revision
  - id: mira-policy
    resource: https://github.com/Vexillon-ai/MIRA/blob/91e128431c93d6efab5bcb450aa50b42df8f8a01/src/companion/policy.rs
    title: Observed proactive policy gates
    author: organization:vexillon-ai
  - id: vellum-checks
    resource: https://github.com/vellum-ai/vellum-assistant/blob/bd79e0797681bfb2cf76f50d6f0bc2ad84e995e8/assistant/src/notifications/deterministic-checks.ts
    title: Observed deterministic deduplication checks
    author: organization:vellum-ai
  - id: android-notifications
    resource: https://developer.android.com/develop/ui/compose/notifications
    title: Android notification controls
    author: organization:google
  - id: local-report
    resource: ../../verifications/assistant/proactive-contact-review-revision/report.json
    title: Local verification report
    author: probe:proactive-contact-review-revision-local
capability:
  id: assistant.prepare-proactive-contact-review-revision
  version: 1.0.0
  subjectRef: /tools/proactive-contact-review-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/prepare-proactive-contact-review-revision-input.schema.json
  outputSchema: /schemas/assistant/prepare-proactive-contact-review-revision-output.schema.json
  resultConcepts: [/concepts/assistant/proactive-contact-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入和输出可能包含私人提醒文案与行为时间，只能在主人授权的本地审阅面短期保留。能力不接受 urgency override、confirmed 或 permission；不解析 credential，不创建消息，不尝试 delivery，不签发执行授权。
verification:
  level: local
  report: /verifications/assistant/proactive-contact-review-revision/report.json
---

# 准备主动联系审阅 Revision

输入一项 `reminder|follow-up|check-in|briefing|status-update` 候选及主人策略/当前状态。Connector 按固定顺序但返回全部原因，检查 opt-in、pause、source 已可见、available/expiry、近期活动、最小间隔、每日上限、连续未回复、IANA 时区静默窗口和近期 dedupe。

通过时，完整 copy、surface、basis/evidence、时间、策略和状态共同进入 hash；人工仍要检查用户收益、打扰程度、敏感内容、受众、重复、snooze/dismiss/disable 与取消语义。发送端不能只消费 hash，而要重新发现当前通知 permission、surface 和策略状态。

本地 probe 固定观察 MIRA/Vellum 的生产语义和 Android 官方用户控制规范，执行正常、跨午夜静默、opt-out/pause/recent activity/min-gap/daily/unanswered/source-visible/dedupe、过期及 mutation fixture。没有真实系统通知权限、主人点击、消息创建、surface delivery、receipt 或长期用户福祉实验，因此这些不能从该能力推断。

- [输入 Schema](../../schemas/assistant/prepare-proactive-contact-review-revision-input.schema.json)
- [输出 Schema](../../schemas/assistant/prepare-proactive-contact-review-revision-output.schema.json)
- [验证报告](../../verifications/assistant/proactive-contact-review-revision/report.json)

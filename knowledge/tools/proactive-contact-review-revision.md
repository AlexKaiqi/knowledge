---
type: Tool
title: 主动联系审阅 Revision 准备器
description: 将一次提醒、跟进、关心、简报或状态更新候选与主人 opt-in、静默期、频控、上下文、去重和精确触达面冻结成人审对象；不发送。
tags: [personal-assistant, proactive, notification, quiet-hours, frequency, dedupe, human-review]
generated: { by: connector:proactive-contact-review-revision, at: 2026-08-27T04:28:03Z }
verified:
  - { by: probe:proactive-contact-review-revision-local-20260827, at: 2026-08-27T04:28:03Z }
status: stable
stale_after: 2026-09-26T04:28:03Z
sources:
  - id: mira-policy
    resource: https://github.com/Vexillon-ai/MIRA/blob/91e128431c93d6efab5bcb450aa50b42df8f8a01/src/companion/policy.rs
    title: MIRA companion pure policy gates
    author: organization:vexillon-ai
  - id: vellum-checks
    resource: https://github.com/vellum-ai/vellum-assistant/blob/bd79e0797681bfb2cf76f50d6f0bc2ad84e995e8/assistant/src/notifications/deterministic-checks.ts
    title: Vellum deterministic notification checks
    author: organization:vellum-ai
  - id: android-control
    resource: https://developer.android.com/develop/ui/compose/notifications
    title: Android notification user control and redundancy guidance
    author: organization:google
  - id: android-permission
    resource: https://developer.android.com/develop/ui/compose/notifications/notification-permission
    title: Android notification runtime permission
    author: organization:google
  - id: local-verification
    resource: ../verifications/assistant/proactive-contact-review-revision/report.json
    title: Proactive contact review verification
    author: probe:proactive-contact-review-revision-local
---

# 主动联系审阅 Revision 准备器

这个工具只判断一项主动联系候选能否进入人工审阅。输入固定主人 scope、显式 opt-in 与 pause、IANA 时区静默窗口、最小间隔、每日/连续未回复上限、近期活动、dedupe 观察，以及候选的依据、证据、有效期、精确 surface 和短文案。

Connector 保守保留所有 suppression reason：未 opt-in、暂停、候选尚未生效、主人刚在互动、频率/未回复达到上限、静默期、相同候选近期出现，或信息已经在当前 source 可见。候选过期则 blocked。所谓“高紧急”不能绕过这些门；真正安全告警需要独立、专门验证的能力。

通过只得到 `eligible-for-human-review` 和稳定 revision hash，七项检查仍 pending。结果不会创建消息、选择实际账号、尝试任何 surface、发送通知或授权执行。MIRA 的 AGPL 实现只作为行为证据观察，本 Connector 是独立实现，没有复制其源码。

- [准备主动联系审阅 Revision](../capabilities/assistant/prepare-proactive-contact-review-revision.md)
- [Proactive Contact Review Revision](../concepts/assistant/proactive-contact-review-revision.md)

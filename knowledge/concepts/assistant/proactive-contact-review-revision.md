---
type: Concept
title: Proactive Contact Review Revision
description: 把一次主人范围内的主动联系候选与完整文案、依据、触达面、时间窗、用户控制、频控和观察状态绑定的待人工审阅对象。
tags: [assistant, proactive-contact, opt-in, quiet-hours, deduplication, immutable-review, non-delivery]
generated: { by: connector:proactive-contact-review-revision, at: 2026-08-27T04:28:03Z }
verified:
  - { by: probe:proactive-contact-review-revision-local-20260827, at: 2026-08-27T04:28:03Z }
status: stable
stale_after: 2026-09-26T04:28:03Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/proactive-contact-review-revision/snapshot.json
    title: Verified proactive contact review revision
    author: connector:proactive-contact-review-revision
---

# Proactive Contact Review Revision

`Proactive Contact Review Revision` 是调度/推断与真实通知发送之间的不可变 handoff。它绑定：

- 谁的策略与哪个 owner scope；
- 候选为何值得联系、证据和后果依据；
- 完整 title/body、精确 surface、available/expiry；
- 当时观察到的 opt-in、pause、静默窗口、频控、近期互动、连续未回复和 dedupe 状态。

只有所有硬门通过才存在 `reviewRevisionHash`。copy、surface、时间、策略或观察状态变化都产生新 revision，旧审阅不能复用。`suppressed` 表示当前不应打扰，不是永久拒绝；状态变化后必须重新评估。`blocked` 当前只用于过期候选。

该对象不包含通知 permission、credential、实际 channel destination、reviewer identity、delivery ID 或 receipt。后续若建立发送能力，必须重新验证系统通知权限、当前 surface 可达性、revision 和一次性执行状态。

- [输出 Schema](../../schemas/assistant/prepare-proactive-contact-review-revision-output.schema.json)
- [验证样本](../../verifications/assistant/proactive-contact-review-revision/snapshot.json)

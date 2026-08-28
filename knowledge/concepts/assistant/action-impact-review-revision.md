---
type: Concept
title: Action Impact Review Revision
description: 将一个 grounded 动作候选与精确参数、目标、影响、证据和有效期绑定的待人工审阅对象；它不是用户决策、确认 token 或执行授权。
tags: [assistant, action-candidate, impact-review, revision, exact-target, expiry, non-authorization]
generated: { by: connector:action-impact-review-revision, at: 2026-08-27T03:44:29Z }
verified:
  - { by: probe:action-impact-review-revision-local-20260827, at: 2026-08-27T03:44:29Z }
status: stable
stale_after: 2026-09-26T03:44:29Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/action-impact-review-revision/snapshot.json
    title: Verified action impact review revision
    author: connector:action-impact-review-revision
---

# Action Impact Review Revision

`Action Impact Review Revision` 是展示给可信审阅面之前的不可变 handoff。它持有 Action Candidate 的引用与 digest，同时完整冻结本轮要审阅的 scalar arguments、scope、targets、影响声明、证据、review class、pending items 和 expiry。

`reviewRevisionHash` 包含这些字段与有效期。动作名、参数、目标、受众、费用、可逆性或有效期任何变化都必须生成新 revision，旧审阅不能无声套用。该对象不会把 `candidateDigest` 自行解释成可信授权；执行网关仍须重新解析 candidate、action contract、target 和实际平台状态。

`status=ready-for-human-review` 只表示审阅材料结构完整。它不记录谁批准、何时批准，也不生成可消费凭证。后续若建立 Authorization Grant，必须是独立 Capability，并以真实用户交互和安全存储完成 sandbox/live probe。

- [输出 Schema](../../schemas/assistant/prepare-action-impact-review-revision-output.schema.json)
- [验证样本](../../verifications/assistant/action-impact-review-revision/snapshot.json)

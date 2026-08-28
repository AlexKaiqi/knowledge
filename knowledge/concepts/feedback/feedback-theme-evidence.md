---
type: Concept
title: Feedback Theme Evidence
description: 以有界样本为范围，回链支持证据与反例、保留冲突和缺口、明确推断性质的待人审反馈主题集合。
tags: [feedback, theme-evidence, sample-only, counterevidence, human-review]
generated: { by: connector:feedback-theme-synthesis-agent, at: 2026-08-27T02:43:34Z }
verified:
  - { by: probe:feedback-theme-synthesis-local-20260827, at: 2026-08-27T02:43:34Z }
status: experimental
stale_after: 2026-09-10T02:43:34Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/feedback/theme-synthesis/snapshot.json
    title: Verified feedback theme evidence fixture
    author: connector:feedback-theme-synthesis-agent
---

# Feedback Theme Evidence

`Feedback Theme Evidence` 是从一次明确样本形成的决策支持对象，不是用户总体画像、市场比例或 roadmap 决策。每个 theme 包含 problem statement、workflow、支持/反例 evidence refs、受影响 revision refs、置信度以及样本内支持数。

所有 theme 都标记 `inference=true`。证据原陈述不复制到输出；调用者通过 evidence ref 回查有权访问的来源。没有归入主题的项进入 `unassignedEvidenceRefs`，矛盾证据进入 `conflicts`，未知信息进入 `gaps`，避免强行制造整齐结论。

`humanReviewRequired=true` 和 `executionAuthorized=false` 固定成立。即使 conformance 通过，也只证明结果符合引用和边界契约，不证明 Agent 的主题在语义上正确或完整。

- [输出 Schema](../../schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json)
- [验证样本](../../verifications/feedback/theme-synthesis/snapshot.json)

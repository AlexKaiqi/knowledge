---
type: Concept
title: Consented Feedback Intake Review Revision
description: 一条尚未持久化的自有反馈及其准确用途、通知、同意、隐私审阅、保留和撤回边界的内容寻址待审快照。
tags: [feedback, intake, revision, consent, purpose, privacy, retention]
generated: { by: connector:consented-feedback-intake-revision, at: 2026-08-27T09:26:02.482Z }
verified:
  - { by: probe:consented-feedback-intake-review-revision-local-20260827, at: 2026-08-27T09:26:02.482Z }
status: stable
stale_after: 2026-09-26T09:26:02.482Z
sources:
  - id: capability
    resource: ../../capabilities/feedback/prepare-consented-intake-review-revision.md
    title: 准备经同意的反馈接收审阅 Revision
    author: capability:feedback.prepare-consented-intake-review-revision
  - id: local-report
    resource: ../../verifications/feedback/consented-intake-review-revision/report.json
    title: Local verification report
    author: probe:consented-feedback-intake-review-revision-local
---

# Consented Feedback Intake Review Revision

该对象是“准备接收”而不是“已经收集”。其 hash 覆盖 scope/product/form/notice revision、decision、允许与实际 purpose、逐字段内容和摘要、consent 时间与证据、其他人员数据声明、隐私审阅、删除期限、撤回机制以及准备时间。

它故意不携带 respondent identity、账号、邮箱、设备标识、Connector route 或 credential。opaque submission/consent/review refs 只用于同一控制域内的对账，不能用于跨来源识别人。

`ready-for-human-review` 只说明结构和显式声明通过保守预检。它不证明正文真的去身份化、consent 在特定法律下有效、存储已经发生或撤回一定可执行；这些事实必须由人审、独立 ingestion receipt 和删除/撤回 receipt 分别证明。

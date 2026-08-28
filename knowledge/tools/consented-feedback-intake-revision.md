---
type: Tool
title: 经同意反馈接收 Revision 准备器
description: 冻结自有反馈的目的、字段、通知、同意、隐私审阅、保留与撤回边界，生成无存储授权的待审 Revision。
tags: [feedback, intake, consent, privacy-review, retention, withdrawal]
generated: { by: connector:consented-feedback-intake-revision, at: 2026-08-27T09:26:02.482Z }
verified:
  - { by: probe:consented-feedback-intake-review-revision-local-20260827, at: 2026-08-27T09:26:02.482Z }
status: stable
stale_after: 2026-09-26T09:26:02.482Z
sources:
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: w3c-data-privacy-vocabulary
    resource: https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20221205/
    title: Data Privacy Vocabulary
    author: organization:w3c-dpvcg
  - id: owasp-logging
    resource: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
    title: Logging Cheat Sheet
    author: organization:owasp
  - id: local-verification
    resource: ../verifications/feedback/consented-intake-review-revision/report.json
    title: Consented feedback intake local verification
    author: probe:consented-feedback-intake-review-revision-local
---

# 经同意反馈接收 Revision 准备器

确定性本地工具。它接受调用者审阅过的 feedback scope 与 submission，精确绑定产品/表单/通知 revision、decision、purpose、逐字段正文与摘要、consent evidence、隐私审阅、保留政策和撤回机制。

它不访问表单服务，不验证真实人员身份，不检测 PII，不判定法律合规，也不存储或回复反馈。通过预检只代表这份材料可以交给人审和后续独立 ingestion；任何字段变化都会产生不同 revision hash。

- [准备经同意的反馈接收审阅 Revision](../capabilities/feedback/prepare-consented-intake-review-revision.md)
- [Consented Feedback Intake Review Revision](../concepts/feedback/consented-feedback-intake-review-revision.md)

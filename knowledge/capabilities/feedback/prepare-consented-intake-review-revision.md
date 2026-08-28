---
type: Capability
title: 准备经同意的反馈接收审阅 Revision
description: 把一条自有表单、支持、访谈或用户研究反馈与目的、通知版本、同意证据、隐私审阅、保留期限和撤回机制冻结为不可变待审 Revision。
tags: [feedback, intake, consent, purpose, deidentification, retention, withdrawal, review-revision]
outcomes: [feedback-collection, product-research]
generated: { by: connector:consented-feedback-intake-revision, at: 2026-08-27T09:26:02.482Z }
verified:
  - { by: probe:consented-feedback-intake-review-revision-local-20260827, at: 2026-08-27T09:26:02.482Z }
status: stable
stale_after: 2026-09-26T09:26:02.482Z
sources:
  - id: subject
    resource: ../../tools/consented-feedback-intake-revision.md
    title: 经同意反馈接收 Revision 准备器
    author: tool:consented-feedback-intake-revision
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
  - id: local-report
    resource: ../../verifications/feedback/consented-intake-review-revision/report.json
    title: Local verification report
    author: probe:consented-feedback-intake-review-revision-local
capability:
  id: feedback.prepare-consented-intake-review-revision
  version: 1.0.0
  subjectRef: /tools/consented-feedback-intake-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/feedback/prepare-consented-intake-review-revision-input.schema.json
  outputSchema: /schemas/feedback/prepare-consented-intake-review-revision-output.schema.json
  resultConcepts: [/concepts/feedback/consented-feedback-intake-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入是调用者已按其政策审阅的反馈内容与 opaque evidence refs；能力不接收人员、邮箱、账号、设备或跨平台身份字段，不访问平台，也不证明 consent 的法律效力或自动检测个人信息。任何持久化、回执、撤回、删除、回复和知识写入均需下游独立能力与授权。
verification:
  level: local
  report: /verifications/feedback/consented-intake-review-revision/report.json
---

# 准备经同意的反馈接收审阅 Revision

这条能力补齐自有产品反馈进入观察与主题链条前的入口边界。调用者提交一个已版本化的反馈 scope、产品 revision、要支持的 decision、允许目的、准确表单字段、通知 revision，以及一条来自产品表单、支持表单、访谈或用户研究的反馈。结果冻结正文、逐项语义摘要、同意状态/时间/证据、撤回机制、隐私审阅和删除期限。

只有以下条件同时成立才得到 `ready-for-human-review`：

- submission 的用途都在 scope 内，字段与固定 form revision 完全一致；
- consent 当前为 `given`，引用同一通知版本，在提交前捕获且准备时仍有效；
- 没有未解决的其他人员数据；
- caller 的隐私审阅为 `passed`，直接标识与敏感信息已经缺省或移除，并禁止重识别；
- 删除期限尚未到且不超过 Connector 配置的最长保留期。

输出仍只是待人审 Revision。`stored`、`receiptIssued`、`withdrawalApplied`、`replySent`、`knowledgeWritten` 和 `executionAuthorized` 固定为 `false`。后续存储必须签发独立 receipt；撤回/删除要引用 receipt 或 revision；主题归纳只能消费经持久化和授权的 evidence，而不能把本结果本身冒充已收集反馈。

本能力不会扫描正文来判断是否含个人或敏感信息，也不认证匿名化、合法依据或管辖区合规。W3C 的 purpose、withdrawal 和 controlled de-identification 原则，以及 OWASP 的日志排除建议被吸收为保守的产品契约，不是法律结论。

- [输入 Schema](../../schemas/feedback/prepare-consented-intake-review-revision-input.schema.json)
- [输出 Schema](../../schemas/feedback/prepare-consented-intake-review-revision-output.schema.json)
- [验证报告](../../verifications/feedback/consented-intake-review-revision/report.json)

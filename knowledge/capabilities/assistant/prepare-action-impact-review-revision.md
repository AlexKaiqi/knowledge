---
type: Capability
title: 准备动作影响审阅 Revision
description: 将 grounded Action Candidate 与精确目标、参数、影响和有效期绑定为保守分级的待人审 revision，不授予执行权限。
tags: [personal-assistant, action-review, authorization-boundary, impact, revision, human-review]
outcomes: [product-research, app-publishing, distribution]
generated: { by: connector:action-impact-review-revision, at: 2026-08-27T03:44:29Z }
verified:
  - { by: probe:action-impact-review-revision-local-20260827, at: 2026-08-27T03:44:29Z }
status: stable
stale_after: 2026-09-26T03:44:29Z
sources:
  - id: subject
    resource: ../../tools/action-impact-review-revision.md
    title: 动作影响审阅 Revision 准备器
    author: tool:action-impact-review-revision
  - id: resource-indicators
    resource: https://www.rfc-editor.org/rfc/rfc8707.html
    title: RFC 8707 Resource Indicators for OAuth 2.0
    author: organization:ietf
  - id: rich-authorization
    resource: https://www.rfc-editor.org/rfc/rfc9396.html
    title: RFC 9396 OAuth 2.0 Rich Authorization Requests
    author: organization:ietf
  - id: production-confirmation
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/domain.mjs
    title: Revision-bound one-time confirmation primitive
    author: organization:alex-kaiqi
  - id: pet-authorization
    resource: https://github.com/AlexKaiqi/dsh-pet-assistant/blob/77ea504f5267ac0f929d4fc81301f999899f270b/dsh/core.js
    title: Current-turn explicit delegation authorization
    author: organization:alex-kaiqi
  - id: knowledge-confirmation
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json
    title: Personal knowledge proposal-confirmation-receipt flow
    author: organization:alex-kaiqi
  - id: local-report
    resource: ../../verifications/assistant/action-impact-review-revision/report.json
    title: Local verification report
    author: probe:action-impact-review-revision-local
capability:
  id: assistant.prepare-action-impact-review-revision
  version: 1.0.0
  subjectRef: /tools/action-impact-review-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/assistant/prepare-action-impact-review-revision-input.schema.json
  outputSchema: /schemas/assistant/prepare-action-impact-review-revision-output.schema.json
  resultConcepts: [/concepts/assistant/action-impact-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 参数预览可能含个人数据，只能在授权审阅面短期保留。能力不接受 confirmed/approve 字段，不读取凭据，不签发 token，不持久化 reviewer identity，不调用 action，也不能作为执行网关的授权依据。
verification:
  level: local
  report: /verifications/assistant/action-impact-review-revision/report.json
---

# 准备动作影响审阅 Revision

输入一个已 grounded 的 Action Candidate 引用与 digest、完整 scalar argument preview、scope、精确 target refs、影响声明、证据、请求时间和 60–3600 秒有效期。impact 明确保留 data class、audience、reversibility、cost ceiling 与 consequence refs，不依赖一段模糊的“高风险/低风险”文本。

Connector 保守生成 review class、risk signals 和逐项 pending review checklist。金融、凭据、不可逆或未知费用进入 critical；平台写、通信、身份关系、confidential、公开/未知受众或有界费用至少 high。分级只帮助安排审阅，未证明上游 impact 声明真实完整，执行前必须由可信 action contract 再校验。

本地 probe 实际消费已经通过验证的 reminder Action Candidate，生成 high review revision，并证明参数、target、有效期变化都会换 hash；还验证未 grounded、金融费用缺失、通信受众缺失和 consequence evidence 缺失会阻断。probe 同时固定核对 Social Workbench、Pet Assistant、Personal Knowledge 的生产确认边界及 RFC 8707/9396 语义。

验证没有包含用户点击、声纹、reviewer identity、token issuance、一次性 consume、撤销、执行或 receipt，因此这些都不能从该能力推断。

- [输入 Schema](../../schemas/assistant/prepare-action-impact-review-revision-input.schema.json)
- [输出 Schema](../../schemas/assistant/prepare-action-impact-review-revision-output.schema.json)
- [验证报告](../../verifications/assistant/action-impact-review-revision/report.json)

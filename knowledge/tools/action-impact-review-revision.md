---
type: Tool
title: 动作影响审阅 Revision 准备器
description: 将已 grounded 的 Action Candidate、精确目标、参数、数据/受众/费用/可逆性影响与有效期冻结成人工审阅对象，但不接受决策或授予执行权。
tags: [personal-assistant, action-review, impact, exact-target, revision, human-review, non-authorization]
generated: { by: connector:action-impact-review-revision, at: 2026-08-27T03:44:29Z }
verified:
  - { by: probe:action-impact-review-revision-local-20260827, at: 2026-08-27T03:44:29Z }
status: stable
stale_after: 2026-09-26T03:44:29Z
sources:
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
    title: dsh-social-workbench revision-bound confirmation primitive
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/assistant/action-impact-review-revision/report.json
    title: Action impact review revision verification
    author: probe:action-impact-review-revision-local
---

# 动作影响审阅 Revision 准备器

这个工具接在 `Memory-grounded Action Candidate` 之后、任何授权或执行之前。它冻结候选摘要、完整 scalar 参数预览、scope、一个或多个精确 target ref、数据类别、外部受众、费用上限、可逆性、后果证据和有效期。

Connector 只做确定性、保守的审阅准备。`platform-write`、communication、identity relationship、公开/未知受众、confidential data 或有界费用至少进入 high；financial effect、credential data、不可逆、未知费用进入 critical。风险等级是审阅排序，不是 policy allow/deny decision。

未 grounded 的候选、没有 consequence evidence 的有影响动作、没有费用声明的金融动作、没有受众声明的通信动作会被阻断。通过时每项审阅仍为 `pending`，`reviewerDecision=null`、`authorizationGranted=false`、`confirmationTokenIssued=false`、`executionAuthorized=false` 固定成立。

RFC 8707/9396 用于说明为什么目标资源和结构化授权细节必须明确且防止调包；本工具不是 OAuth Authorization Server，也不生成 access token。真正批准仍必须由可信 UI/Host 绑定当前用户交互、review revision、一次性消费和撤销状态。

- [准备动作影响审阅 Revision](../capabilities/assistant/prepare-action-impact-review-revision.md)
- [Action Impact Review Revision](../concepts/assistant/action-impact-review-revision.md)

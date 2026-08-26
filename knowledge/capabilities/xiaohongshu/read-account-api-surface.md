---
type: Capability
title: 读取小红书账号 API 接口面
description: 从小红书官方公开参考页返回经过语义校验的账号 API 结构化目录。
tags: [xiaohongshu, query, official-document]
outcomes: [content-publishing, product-research]
generated: { by: connector:xiaohongshu-account-docs, at: 2026-08-26T16:35:24Z }
verified:
  - { by: probe:xiaohongshu-account-api-live-20260826, at: 2026-08-26T16:35:24Z }
status: stable
stale_after: 2026-09-02T16:35:24Z
sources:
  - id: subject
    resource: ../../sources/xiaohongshu-account-api.md
    title: 小红书账号开放平台 API 参考
    author: organization:xiaohongshu
  - id: live-report
    resource: ../../verifications/xiaohongshu/account-api/report.json
    title: Live verification report
    author: probe:xiaohongshu-account-api-live
capability:
  id: xiaohongshu.account-api.read-surface
  version: 1.0.0
  subjectRef: /sources/xiaohongshu-account-api.md
  kind: query
  effect: none
  inputSchema: /schemas/xiaohongshu/account-api-surface-input.schema.json
  outputSchema: /schemas/xiaohongshu/account-api-surface-output.schema.json
  resultConcepts: [/concepts/xiaohongshu/account-api-surface.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [web-document]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只读取公开官方文档；不调用需要应用凭据或用户授权的业务接口。
verification:
  level: live
  report: /verifications/xiaohongshu/account-api/report.json
---

# 读取小红书账号 API 接口面

输入为空对象。输出包含官方参考页当前声明的 Base URL、POST JSON 传输方式、接口目录、操作族、文档未声明的操作族、设备授权安全要求、观测时间和语义摘要。

Connector 在以下任一情况返回 `review-required`，而不是继续把结果当作稳定知识：既有接口缺失、出现未分类 OAuth 路径、页面身份/传输声明变化，或 PKCE、Device Flow 安全约束不再满足。

该能力的副作用为 `none`，不需要账号、Cookie、应用密钥或 probe 身份，也不返回原始 HTML。

- [输入 Schema](../../schemas/xiaohongshu/account-api-surface-input.schema.json)
- [输出 Schema](../../schemas/xiaohongshu/account-api-surface-output.schema.json)
- [验证报告](../../verifications/xiaohongshu/account-api/report.json)

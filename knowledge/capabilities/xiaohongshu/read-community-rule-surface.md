---
type: Capability
title: 读取小红书社区规则接口面
description: 通过只读浏览器渲染和确定性归一化返回小红书社区公约的当前结构与选定义务。
tags: [xiaohongshu, official-rules, query, hybrid]
outcomes: [content-publishing, product-research]
generated: { by: connector:xiaohongshu-community-rules-browser, at: 2026-08-26T16:56:02Z }
verified:
  - { by: probe:xiaohongshu-community-rules-live-20260826, at: 2026-08-26T16:56:02Z }
status: stable
stale_after: 2026-09-02T16:56:02Z
sources:
  - id: subject
    resource: ../../sources/xiaohongshu-community-rules.md
    title: 小红书社区公约 2.0
    author: organization:xiaohongshu
  - id: live-report
    resource: ../../verifications/xiaohongshu/community-rules/report.json
    title: Community rules live verification report
    author: probe:xiaohongshu-community-rules-live
capability:
  id: xiaohongshu.community-rules.read-surface
  version: 1.0.0
  subjectRef: /sources/xiaohongshu-community-rules.md
  kind: query
  effect: none
  inputSchema: /schemas/xiaohongshu/community-rule-surface-input.schema.json
  outputSchema: /schemas/xiaohongshu/community-rule-surface-output.schema.json
  resultConcepts: [/concepts/xiaohongshu/community-rule-surface.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: required
access:
  class: public
  methods: [browser-assisted]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只读取公开官方页面；Agent 不登录、不点击客服、不提交表单，也不读取浏览器存储。
verification:
  level: live
  report: /verifications/xiaohongshu/community-rules/report.json
---

# 读取小红书社区规则接口面

输入为空对象。Connector 在只读浏览器中获取渲染后的标题、版本时间和文章标题结构，再由确定性代码返回规范化投影；外部调用者不需要理解 SPA、DOM 或 Agent 编排。

输出不包含原始 HTML、规则全文、导航、客服内容、浏览器状态或身份信息。结构或选定义务发生变化时，能力明确返回 `review-required`，Collector 只生成复审提案。

- [输入 Schema](../../schemas/xiaohongshu/community-rule-surface-input.schema.json)
- [输出 Schema](../../schemas/xiaohongshu/community-rule-surface-output.schema.json)
- [验证报告](../../verifications/xiaohongshu/community-rules/report.json)

---
type: Concept
title: 小红书账号 API 接口面
description: 某次官方 API 参考页观测中明确声明的接口、传输约束、能力边界与安全要求。
tags: [xiaohongshu, api-surface, capability-boundary]
generated: { by: connector:xiaohongshu-account-docs, at: 2026-08-26T16:35:24Z }
verified:
  - { by: probe:xiaohongshu-account-api-live-20260826, at: 2026-08-26T16:35:24Z }
status: stable
stale_after: 2026-09-02T16:35:24Z
sources:
  - id: information-source
    resource: ../../sources/xiaohongshu-account-api.md
    title: 小红书账号开放平台 API 参考
    author: organization:xiaohongshu
  - id: live-snapshot
    resource: ../../verifications/xiaohongshu/account-api/snapshot.json
    title: Normalized live observation
    author: connector:xiaohongshu-account-docs
---

# 账号 API 接口面

“接口面”是一次可复核观测所得的结构化目录，包括接口路径、标题、Base URL、请求传输方式、能力族和安全要求。

它刻意区分两类结论：

- `documentedOperationFamilies`：该参考页明确覆盖的操作族。
- `notDocumentedInThisReference`：当前参考页没有声明的操作族，仅限定文档边界，不能被解读为对整个平台的否定事实。

语义摘要只覆盖规范化投影，不覆盖页面样式、脚本和原始 HTML。出现新路径、缺失既有路径或关键安全措辞变化时，结果转为 `review-required`，由 Collector 生成提案，不能自动改写 canonical knowledge。

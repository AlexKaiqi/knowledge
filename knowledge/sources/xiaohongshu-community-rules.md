---
type: Information Source
title: 小红书社区公约 2.0
description: 小红书蒲公英帮助中心公开发布、需要浏览器渲染读取的社区行为规范。
tags: [xiaohongshu, official, community-rules, rendered-document]
generated: { by: connector:xiaohongshu-community-rules-browser, at: 2026-08-26T16:56:02Z }
verified:
  - { by: probe:xiaohongshu-community-rules-live-20260826, at: 2026-08-26T16:56:02Z }
status: stable
stale_after: 2026-09-02T16:56:02Z
sources:
  - id: official-rules
    resource: https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4
    title: 小红书社区公约2.0
    author: organization:xiaohongshu
  - id: live-rendered-snapshot
    resource: ../verifications/xiaohongshu/community-rules/snapshot.json
    title: Normalized rendered observation
    author: connector:xiaohongshu-community-rules-browser
---

# 小红书社区公约 2.0

这是小红书蒲公英帮助中心公开提供的官方规则信息源。静态 HTTP 响应只有 SPA 外壳，正文必须经过只读浏览器渲染后观测，不能用状态码或空壳 HTML 指纹判断规则是否未变。

2026-08-27 的 live observation 显示：页面标注版本时间为 2026-07-31，结构包含“真诚分享、友好互动、有序经营”三个部分和 25 条规则标题。

公开 Capability 只返回结构、选定规则义务和语义摘要，不复制整篇正文。任何标题、版本、部分数量、规则数量或选定义务变化都会转为 `review-required`。

- [读取社区规则接口面](../capabilities/xiaohongshu/read-community-rule-surface.md)
- [社区规则接口面概念](../concepts/xiaohongshu/community-rule-surface.md)

---
type: Concept
title: 小红书社区规则接口面
description: 对官方社区公约当前版本、结构与选定行为义务的可验证规范化投影。
tags: [xiaohongshu, community-rules, semantic-surface]
generated: { by: connector:xiaohongshu-community-rules-browser, at: 2026-08-26T16:56:02Z }
verified:
  - { by: probe:xiaohongshu-community-rules-live-20260826, at: 2026-08-26T16:56:02Z }
status: stable
stale_after: 2026-09-02T16:56:02Z
sources:
  - id: information-source
    resource: ../../sources/xiaohongshu-community-rules.md
    title: 小红书社区公约 2.0
    author: organization:xiaohongshu
  - id: live-rendered-snapshot
    resource: ../../verifications/xiaohongshu/community-rules/snapshot.json
    title: Normalized rendered observation
    author: connector:xiaohongshu-community-rules-browser
---

# 社区规则接口面

社区规则接口面不是规则全文副本，而是面向能力判断的最小投影：官方来源、页面标题、标注版本时间、一级部分、规则标题数量、选定行为义务、观测时间与语义摘要。

当前选定义务覆盖原创与真实性、AI 辅助标明、禁止冒充、隐私与反人肉、禁止伪造经营数据、使用平台交易工具和禁止侵权。`documented=true` 只表示当前官方页面存在对应规则标题，不替代完整规则文本或法律判断。

Agent 只负责在浏览器中读取渲染结果；确定性 Connector 负责抽取边界、断言、摘要和 `review-required` 状态。两者都不能自动接受新基线。

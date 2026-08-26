---
type: Concept
title: 小红书本人笔记摘要
description: 从当前自有账号主页读取的、去除内部访问材料后的最小笔记引用。
tags: [xiaohongshu, owned-note, summary]
generated: { by: connector:xiaohongshu-browser, at: 2026-08-26T16:43:43Z }
verified:
  - { by: probe:xiaohongshu-owned-notes-live-20260826, at: 2026-08-26T16:43:43Z }
status: stable
stale_after: 2026-09-02T16:43:43Z
sources:
  - id: platform
    resource: ../../platforms/xiaohongshu.md
    title: 小红书
    author: organization:xiaohongshu
  - id: live-read-report
    resource: ../../verifications/xiaohongshu/owned-notes/report.json
    title: Owned notes live verification report
    author: probe:xiaohongshu-owned-notes-live
---

# 本人笔记摘要

本人笔记摘要是自有账号主页当前返回的一条最小内容引用：

- `externalId`：平台笔记 ID；
- `title`：当前主页展示标题，允许为空；
- `url`：由平台 ID 构造的稳定详情 URL。

摘要不包含正文、媒体、指标、评论、作者资料或任何内部访问材料。尤其不能包含当前请求链中的 `xsec_token`、Cookie、sidecar token、用户名、昵称、头像或浏览器 profile。

空列表表示“端点可用且当前没有返回本人笔记”，不表示 Connector 失败，也不证明平台不存在内容。

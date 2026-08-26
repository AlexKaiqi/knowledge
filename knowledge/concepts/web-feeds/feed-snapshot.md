---
type: Concept
title: 公共 Web Feed 快照
description: 对一个已登记 RSS/Atom Feed 的有界、最小化语义投影，包含条目覆盖范围与语义/文档双摘要。
tags: [web-feed, rss, atom, snapshot, change-detection]
generated: { by: connector:web-feed-reader, at: 2026-08-26T22:47:44Z }
verified:
  - { by: probe:web-feed-reader-nodejs-releases-live-20260826, at: 2026-08-26T22:47:44Z }
status: stable
stale_after: 2026-09-02T22:47:44Z
sources:
  - { id: tool, resource: ../../tools/web-feed-reader.md, title: Web Feed Reader, author: connector:web-feed-reader }
  - { id: rss, resource: https://www.rssboard.org/rss-specification, title: RSS 2.0 Specification, author: organization:rss-advisory-board }
  - { id: atom, resource: https://www.rfc-editor.org/rfc/rfc4287.html, title: The Atom Syndication Format, author: organization:ietf }
  - { id: snapshot, resource: ../../verifications/web-feeds/nodejs-releases/snapshot.json, title: Node.js release feed live snapshot, author: connector:web-feed-reader }
---

# 公共 Web Feed 快照

该概念表示一次已登记 Feed 的有界语义观测。`feedDigest` 基于稳定 Feed 身份和全部条目最小字段，不包含会随站点部署刷新的 Feed-level build/update time；`documentSha256` 基于响应 XML，可捕获 build time、序列化、扩展字段或未暴露内容的变化。两者必须分开解释：文档摘要变化而语义摘要不变时，只触发 Connector/来源复审，不自动改写知识。

`documentEntryCount` 是解析到的总条目数，`returnedCount` 是本次返回数；调用者必须读取 `returnedComplete`，不能把有界前缀误认为全量历史。条目 ID 只在该 Feed 内有意义，不自动等价于稳定 URL 或跨 Feed 全局身份。

快照有意排除正文、摘要、作者、邮箱、附件、未知扩展和原始 XML。它可作为变更信号和后续精确读取入口，但不证明内容正确、完整、授权可复用或来源不会修改历史记录。

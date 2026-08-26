---
type: Tool
title: Web Feed Reader
description: 从经过逐项审阅和登记的公共 RSS/Atom Feed 读取有界、最小化条目；当前只准入 Node.js 官方 Release Feed。
tags: [web-feed, rss, atom, xml, change-observation]
generated: { by: connector:web-feed-reader, at: 2026-08-26T22:47:44Z }
verified:
  - { by: probe:web-feed-reader-nodejs-releases-live-20260826, at: 2026-08-26T22:47:44Z }
status: stable
stale_after: 2026-09-02T22:47:44Z
sources:
  - { id: rss, resource: https://www.rssboard.org/rss-specification, title: RSS 2.0 Specification, author: organization:rss-advisory-board }
  - { id: atom, resource: https://www.rfc-editor.org/rfc/rfc4287.html, title: The Atom Syndication Format, author: organization:ietf }
  - { id: node-feed, resource: https://nodejs.org/en/feed/releases.xml, title: Node.js Blog Release Feed, author: organization:nodejs }
  - { id: report, resource: ../verifications/web-feeds/nodejs-releases/report.json, title: Node.js release feed live verification report, author: probe:web-feed-reader-nodejs-releases-live }
---

# Web Feed Reader

Web Feed Reader 把“读取一个已审阅的公共 Feed”暴露为简单查询。调用者只提供稳定的 `feedId` 和返回条数；Connector 内部拥有固定 URL、格式、Feed 身份、允许的条目链接来源和资源预算。它不是通用 URL 抓取器。

当前登记项只有 `nodejs-releases`：`https://nodejs.org/en/feed/releases.xml`。该路线已通过 production-public live probe，实际解析 RSS 2.0 的 807 个条目，并有界返回前 10 个。解析器也实现 Atom 1.0 契约测试，但尚无 Atom Feed 通过独立 live probe，因此 Atom 只是 Connector 的已测试格式能力，不是当前已准入的数据源。

输出只包含 Feed 身份、标题、语言、更新时间、条目 ID/标题/链接/时间、覆盖范围、内容摘要和最小传输事实。正文、摘要、作者、邮箱、附件、扩展字段和原始 XML 均不暴露。

新增 Feed 必须逐项审阅其规范、身份、允许的链接 origin、隐私字段、许可/条款、体积和稳定 fixture，并单独通过 live probe；不能仅把 URL 写进配置。

- [读取已登记公共 Feed](../capabilities/web-feeds/read-registered-public-feed.md)

---
type: Capability
title: 读取已登记公共 Web Feed
description: 按固定 feedId 读取经过逐项审阅的 RSS/Atom Feed，返回有界、最小化条目和可区分的语义/文档摘要。
tags: [web-feed, rss, atom, registered-source, change-observation]
generated: { by: connector:web-feed-reader, at: 2026-08-26T22:47:44Z }
verified:
  - { by: probe:web-feed-reader-nodejs-releases-live-20260826, at: 2026-08-26T22:47:44Z }
status: stable
stale_after: 2026-09-02T22:47:44Z
sources:
  - { id: subject, resource: ../../tools/web-feed-reader.md, title: Web Feed Reader, author: connector:web-feed-reader }
  - { id: rss, resource: https://www.rssboard.org/rss-specification, title: RSS 2.0 Specification, author: organization:rss-advisory-board }
  - { id: atom, resource: https://www.rfc-editor.org/rfc/rfc4287.html, title: The Atom Syndication Format, author: organization:ietf }
  - { id: node-feed, resource: https://nodejs.org/en/feed/releases.xml, title: Node.js Blog Release Feed, author: organization:nodejs }
  - { id: report, resource: ../../verifications/web-feeds/nodejs-releases/report.json, title: Live verification report, author: probe:web-feed-reader-nodejs-releases-live }
capability:
  id: web-feeds.read-registered-public-feed
  version: 1.0.0
  subjectRef: /tools/web-feed-reader.md
  kind: query
  effect: none
  inputSchema: /schemas/web-feeds/read-registered-public-feed-input.schema.json
  outputSchema: /schemas/web-feeds/read-registered-public-feed-output.schema.json
  resultConcepts: [/concepts/web-feeds/feed-snapshot.md]
  executionCharacteristics: { determinism: mixed, humanReview: none, agentInvolvement: none }
access:
  class: public
  methods: [public-feed]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只读取逐项登记的公共 Feed；条目与链接仍受来源条款、版权、撤回和修订政策约束。新增来源必须独立审阅和验证。
verification: { level: live, report: /verifications/web-feeds/nodejs-releases/report.json }
---

# 读取已登记公共 Web Feed

输入只接受登记表中的 `feedId` 和 1–20 的 `limit`。当前唯一可用 ID 是 `nodejs-releases`。Connector 固定请求 Node.js 官方 Feed，不接受 URL、host、header、凭据、代理或重定向，也不自动重试；响应限制 512 KiB，文档最多 1,000 个条目。

XML 使用 namespace-aware 严格解析，并拒绝 DTD、重复关键字段、标题内 markup、无效日期、非 HTTPS/非登记来源链接和身份漂移。RSS 2.0 已通过真实 Feed 验证；Atom 1.0 只有本地契约测试，直到某个 Atom 来源单独通过 live probe 前，不应声称已有可用 Atom 数据源。

输出只保留 Feed 身份、标题、语言、更新时间、条目 ID/标题/URL/发布时间/更新时间、覆盖范围、语义摘要、原始文档摘要和最小传输事实。正文、摘要、作者、邮箱、附件、扩展字段和 raw XML 被剔除。

该能力适合为 Collector 提供低成本变更信号，但 Feed 是来源维护的可变投影：它不能替代精确资源 API、历史全量、内容真实性审查或授权判断。

- [输入 Schema](../../schemas/web-feeds/read-registered-public-feed-input.schema.json)
- [输出 Schema](../../schemas/web-feeds/read-registered-public-feed-output.schema.json)
- [验证报告](../../verifications/web-feeds/nodejs-releases/report.json)

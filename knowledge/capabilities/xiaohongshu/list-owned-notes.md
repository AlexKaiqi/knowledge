---
type: Capability
title: 读取小红书本人笔记
description: 通过明确授权的自有账号会话返回本人主页当前可见的最小笔记摘要列表。
tags: [xiaohongshu, owned-account, query]
outcomes: [content-publishing, influence-measurement]
generated: { by: connector:xiaohongshu-browser, at: 2026-08-26T16:43:43Z }
verified:
  - { by: probe:xiaohongshu-owned-notes-live-20260826, at: 2026-08-26T16:43:43Z }
status: stable
stale_after: 2026-09-02T16:43:43Z
sources:
  - id: subject
    resource: ../../platforms/xiaohongshu.md
    title: 小红书
    author: organization:xiaohongshu
  - id: live-report
    resource: ../../verifications/xiaohongshu/owned-notes/report.json
    title: Owned notes live verification report
    author: probe:xiaohongshu-owned-notes-live
capability:
  id: xiaohongshu.note.list-owned
  version: 1.0.0
  subjectRef: /platforms/xiaohongshu.md
  kind: query
  effect: none
  inputSchema: /schemas/xiaohongshu/list-owned-notes-input.schema.json
  outputSchema: /schemas/xiaohongshu/list-owned-notes-output.schema.json
  resultConcepts: [/concepts/xiaohongshu/owned-note-summary.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: owned
  methods: [browser-assisted]
  accountRequired: true
  durableRetention: restricted
  authorizationNotes: 只允许使用用户明确授权的自有账号会话；不得读取、归并或模拟第三方身份。
verification:
  level: live
  report: /verifications/xiaohongshu/owned-notes/report.json
---

# 读取小红书本人笔记

输入可指定 `limit`（1–100，默认 20）。输出是当前自有账号主页返回的笔记摘要列表及观测时间；空列表是合法成功结果。

该能力没有平台写入副作用，但需要仓库外的账号会话和 loopback-only sidecar。Connector 会先验证会话已登录，再读取本人主页；结果不暴露 Cookie、sidecar token、`xsec_token`、账号身份或作者资料。

这项验证只覆盖本人笔记列表，不覆盖笔记详情、反馈、发布或其它平台行为。

- [输入 Schema](../../schemas/xiaohongshu/list-owned-notes-input.schema.json)
- [输出 Schema](../../schemas/xiaohongshu/list-owned-notes-output.schema.json)
- [验证报告](../../verifications/xiaohongshu/owned-notes/report.json)

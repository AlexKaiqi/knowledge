---
type: Capability
title: 读取 GitHub 公共仓库 Work Item 变更
description: 通过官方 REST API 列出一个公共仓库在复合 checkpoint 之后的有界 issue 与 pull-request 变化。
tags: [github, issue, pull-request, incremental, checkpoint, official-api]
generated: { by: connector:github-public-repository-work-item-changes, at: 2026-08-26T23:06:42Z }
verified:
  - { by: probe:github-public-repository-work-item-changes-live-20260826, at: 2026-08-26T23:06:42Z }
status: stable
stale_after: 2026-09-02T23:06:42Z
sources:
  - { id: subject, resource: ../../platforms/github.md, title: GitHub, author: organization:github }
  - { id: issues-api, resource: "https://docs.github.com/en/rest/issues/issues?apiVersion=2026-03-10", title: List repository issues, author: organization:github }
  - { id: pagination, resource: "https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2026-03-10", title: Using pagination in the REST API, author: organization:github }
  - { id: rate-limits, resource: "https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2026-03-10", title: Rate limits for the REST API, author: organization:github }
  - { id: report, resource: ../../verifications/github/public-repository-work-item-changes/report.json, title: Live verification report, author: probe:github-public-repository-work-item-changes-live }
capability:
  id: github.repositories.list-public-work-item-changes
  version: 1.0.0
  subjectRef: /platforms/github.md
  kind: query
  effect: none
  inputSchema: /schemas/github/list-public-repository-work-item-changes-input.schema.json
  outputSchema: /schemas/github/list-public-repository-work-item-changes-output.schema.json
  resultConcepts: [/concepts/github/public-repository-work-item-change-set.md]
  executionCharacteristics: { determinism: mixed, humanReview: none, agentInvolvement: none }
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只读取调用者明确指定的 GitHub 公共仓库；公开可读不代表内容正确、安全或获得复制、训练、再分发及商用授权。不得收集个人资料、规避限流或把窗口当作完整事件日志。
verification: { level: live, report: /verifications/github/public-repository-work-item-changes/report.json }
---

# 读取 GitHub 公共仓库 Work Item 变更

输入只接受 GitHub `owner`、`repository`、上次输出的复合 `checkpoint` 和最多 500 项的预算。Connector 固定官方 `GET /repos/{owner}/{repo}/issues`、API version `2026-03-10`、`state=all`、`sort=updated`、`direction=asc`；每页 100，最多 5 页。调用者不能指定 API host、query 模式、header、token 或 page URL。

GitHub Issues endpoint 会混合返回 issue 和 pull request，因此输出使用 `kind` 明确分类。每项只保留 number、公开 URL、状态、标题、label 名、评论数量、locked、生命周期时间和 body 的长度/SHA-256；不返回 body 正文、作者、assignee、邮箱、头像、评论、timeline 或 raw payload。

Checkpoint 保存边界秒和该秒已见 number/change digest；下次从前一秒重读。未变化的重放被过滤，同秒 digest 变化重新输出，截断时只推进到实际返回项。调用方必须把 `complete=false` 当作未完成窗口并继续调用，不能静默跳到当前时间。

该机制适合 Collector 发现开源项目 issue/PR 状态、标题、标签、评论计数或正文摘要变化，但不是 webhook、审计日志或 exactly-once stream。翻页并发、秒级时间精度、删除、权限变化和资源上限仍可能造成缺口；周期性重叠与人工复审不可省略。

production-public probe 无身份读取 `tamnd/xiaohongshu-cli`，一次请求得到完整的单项窗口并命中公开 issue 18；13 项响应、checkpoint、覆盖和最小化检查全部通过。

- [输入 Schema](../../schemas/github/list-public-repository-work-item-changes-input.schema.json)
- [输出 Schema](../../schemas/github/list-public-repository-work-item-changes-output.schema.json)
- [验证报告](../../verifications/github/public-repository-work-item-changes/report.json)

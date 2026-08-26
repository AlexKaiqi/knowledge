---
type: Capability
title: 读取 GitHub 公共仓库 Tag 集合
description: 通过 GitHub 官方 REST API 串行分页，返回最多 500 个 tag 的有界快照和显式完整性边界。
tags: [github, repository, git-tag, official-api]
outcomes: [product-research]
generated: { by: connector:github-public-repository-tags, at: 2026-08-26T19:04:40Z }
verified:
  - { by: probe:github-public-repository-tags-live-20260826, at: 2026-08-26T19:04:40Z }
status: stable
stale_after: 2026-09-02T19:04:40Z
sources:
  - id: subject
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-report
    resource: ../../verifications/github/public-repository-tags/report.json
    title: Live verification report
    author: probe:github-public-repository-tags-live
capability:
  id: github.repositories.list-public-tags
  version: 1.0.0
  subjectRef: /platforms/github.md
  kind: query
  effect: none
  inputSchema: /schemas/github/list-public-repository-tags-input.schema.json
  outputSchema: /schemas/github/list-public-repository-tags-output.schema.json
  resultConcepts: [/concepts/github/public-repository-tag-set.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅访问明确指定的 GitHub 公共仓库；不得用结果规避限流、推断私有仓库或将 tag 元数据冒充许可证、安全审计和可执行能力证明。
verification:
  level: live
  report: /verifications/github/public-repository-tags/report.json
---

# 读取 GitHub 公共仓库 Tag 集合

输入为 GitHub owner、repository 和可选 `maxTags`。Connector 固定官方 `GET /repos/{owner}/{repo}/tags`、API 版本 `2026-03-10`，每次最多请求 100 项、串行请求不超过 5 次，总计最多返回 500 个 tag。

输出仅保留仓库 URL、tag 名称、目标 commit SHA、请求数、`core` 限流状态、完整/截断状态和规范化摘要。`tagSetComplete: false` 是合法的有界结果，但不能作为完整 release 清单；需要完整集合的 Collector 必须拒绝该结果并提出扩大预算或更换 fixture。

Connector 不接受任意 API Base URL，不发送共享 token，不跟随重定向，每页限制 2 MiB，也不在 `403/429` 后重试。它不读取 tag message、tagger、签名、release 对象或 archive，不下载或执行仓库内容，也不证明 tag 不会移动。

- [输入 Schema](../../schemas/github/list-public-repository-tags-input.schema.json)
- [输出 Schema](../../schemas/github/list-public-repository-tags-output.schema.json)
- [验证报告](../../verifications/github/public-repository-tags/report.json)

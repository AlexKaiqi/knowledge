---
type: Capability
title: 搜索 GitHub 公共仓库
description: 通过 GitHub 官方 REST API 返回有界、覆盖边界显式的公共仓库排序分页。
tags: [github, query, repository-search, official-api]
generated: { by: connector:github-public-repository-search, at: 2026-08-26T17:13:25Z }
verified:
  - { by: probe:github-public-repository-search-live-20260826, at: 2026-08-26T17:13:25Z }
status: stable
stale_after: 2026-09-02T17:13:25Z
sources:
  - id: subject
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-report
    resource: ../../verifications/github/public-repository-search/report.json
    title: Live verification report
    author: probe:github-public-repository-search-live
capability:
  id: github.repositories.search-public
  version: 1.0.0
  subjectRef: /platforms/github.md
  kind: query
  effect: none
  inputSchema: /schemas/github/search-public-repositories-input.schema.json
  outputSchema: /schemas/github/search-public-repositories-output.schema.json
  resultConcepts: [/concepts/github/public-repository-search-result.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 查询会发送给 GitHub；不得包含秘密或无权披露的个人数据。仅保留有界公共仓库元数据，禁止垃圾信息、个人信息销售、画像用途和限流规避。
verification:
  level: live
  report: /verifications/github/public-repository-search/report.json
---

# 搜索 GitHub 公共仓库

输入包含 GitHub repository search query、排序、方向、页码和每页数量；Connector 将每页限制为 25、页码限制为 10，并固定请求官方 `GET /search/repositories` 与 API 版本 `2026-03-10`。

输出只包含公共仓库摘要、查询覆盖边界、Search rate-limit 状态、观测时间和结果摘要。`incompleteResults: true`、API 版本不符、非 Search 限流桶或出现非公共结果时，conformance 转为 `review-required`。

Connector 不接受任意 API Base URL，不跟随重定向，不输出原始响应，不使用共享凭据，也不在 `403/429` 后自动重试。搜索结果只适合发现候选；许可证、代码、安全、维护状态和真实 Capability 必须由后续 Collector/Probe 独立验证。

- [输入 Schema](../../schemas/github/search-public-repositories-input.schema.json)
- [输出 Schema](../../schemas/github/search-public-repositories-output.schema.json)
- [验证报告](../../verifications/github/public-repository-search/report.json)

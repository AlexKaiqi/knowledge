---
type: Capability
title: 按精确 Tag 读取 GitHub 公共仓库 Release
description: 通过 GitHub 官方 REST API 读取一个公共、非草稿 release 的有界最小化元数据和资产完整性信号。
tags: [github, repository, release, asset, official-api]
generated: { by: connector:github-public-repository-release, at: 2026-08-26T20:05:12Z }
verified:
  - { by: probe:github-public-repository-release-live-20260826, at: 2026-08-26T20:05:12Z }
status: stable
stale_after: 2026-09-02T20:05:12Z
sources:
  - id: subject
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-report
    resource: ../../verifications/github/public-repository-release/report.json
    title: Live verification report
    author: probe:github-public-repository-release-live
capability:
  id: github.repositories.read-public-release-by-tag
  version: 1.0.0
  subjectRef: /platforms/github.md
  kind: query
  effect: none
  inputSchema: /schemas/github/read-public-repository-release-by-tag-input.schema.json
  outputSchema: /schemas/github/read-public-repository-release-by-tag-output.schema.json
  resultConcepts: [/concepts/github/public-repository-release.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅访问调用者明确指定的 GitHub 公共仓库和精确 release tag；不得下载或执行资产、规避限流、收集发布者身份，或把 GitHub 提供的摘要冒充独立供应链验证。
verification:
  level: live
  report: /verifications/github/public-repository-release/report.json
---

# 按精确 Tag 读取 GitHub 公共仓库 Release

输入为 GitHub owner、repository 和精确 `tagName`。Connector 固定官方 `GET /repos/{owner}/{repo}/releases/tags/{tag}`、API 版本 `2026-03-10`，单次请求上限 2 MiB，不接受 alternate base URL，不跟随重定向，也不在失败或限流后重试。

输出保留 release 页面、状态、最多 4096 字符的说明摘录与完整正文 SHA-256，以及最多 64 个内嵌资产的最小元数据和 GitHub 提供的可选 SHA-256。输出排除 author、uploader、头像、下载计数、tarball/zipball 和原始 payload。

这项能力不读取 draft release，不证明 tag 不会移动，不证明资产集合完整，不下载或重算资产摘要，也不代表源码、许可证、恶意软件或可执行兼容性审计。

- [输入 Schema](../../schemas/github/read-public-repository-release-by-tag-input.schema.json)
- [输出 Schema](../../schemas/github/read-public-repository-release-by-tag-output.schema.json)
- [验证报告](../../verifications/github/public-repository-release/report.json)

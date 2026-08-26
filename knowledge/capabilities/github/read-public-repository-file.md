---
type: Capability
title: 读取 GitHub 公共仓库文件
description: 通过 GitHub 官方 REST API，在完整不可变 commit ID 下读取一个有界 UTF-8 公共仓库文件并返回内容完整性证据。
tags: [github, query, repository-file, immutable-revision, official-api]
generated: { by: connector:github-public-repository-file, at: 2026-08-26T17:54:29Z }
verified:
  - { by: probe:github-public-repository-file-live-20260826, at: 2026-08-26T17:54:29Z }
status: stable
stale_after: 2026-09-02T17:54:29Z
sources:
  - id: subject
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: repository-contents-api
    resource: https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10#get-repository-content
    title: REST API endpoints for repository contents · Get repository content
    author: organization:github
  - id: live-report
    resource: ../../verifications/github/public-repository-file/report.json
    title: Live verification report
    author: probe:github-public-repository-file-live
capability:
  id: github.repositories.read-public-file
  version: 1.0.0
  subjectRef: /platforms/github.md
  kind: query
  effect: none
  inputSchema: /schemas/github/read-public-repository-file-input.schema.json
  outputSchema: /schemas/github/read-public-repository-file-output.schema.json
  resultConcepts: [/concepts/github/public-repository-file.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅允许读取公开仓库文件；必须使用完整 commit ID。文件的公开可读性不授予复制、修改、再分发或商用许可，持久保留必须服从仓库许可证、权利状态和删除要求。
verification:
  level: live
  report: /verifications/github/public-repository-file/report.json
---

# 读取 GitHub 公共仓库文件

输入必须包含 `owner/name` 仓库标识、相对文件路径和完整的 40 位小写 Git commit ID。Connector 固定调用官方 `GET /repos/{owner}/{repo}/contents/{path}`、API 版本 `2026-03-10`，不接受可变 branch/tag、任意 API Base URL、重定向或共享凭据。

输出包含实际请求 identity、Git blob ID、不超过 256 KiB 的 UTF-8 正文、正文 SHA-256、GitHub 网页地址、`core` 限流状态、观测时间和 conformance。目录、超限文件、非 UTF-8、NUL 二进制内容、大小不一致、revision 漂移和响应结构漂移都会被拒绝；API 版本或限流桶变化会转为 `review-required`。

这个能力让 Collector 在固定 revision 上检查 README、LICENSE、manifest 和关键实现证据，但不判断许可证是否有效、代码是否安全或项目能力是否真实。调用方必须另行解释文件，并遵守项目许可证与 GitHub 条款。

- [输入 Schema](../../schemas/github/read-public-repository-file-input.schema.json)
- [输出 Schema](../../schemas/github/read-public-repository-file-output.schema.json)
- [验证报告](../../verifications/github/public-repository-file/report.json)

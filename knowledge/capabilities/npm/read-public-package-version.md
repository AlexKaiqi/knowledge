---
type: Capability
title: 读取 npm 公共包精确版本元数据
description: 从固定 npm Public Registry 读取一个公开包的精确版本，并返回最小化元数据与发行完整性信息。
tags: [npm, registry, package-version, metadata, integrity, official-api]
generated: { by: connector:npm-public-package-version, at: 2026-08-26T18:06:14Z }
verified:
  - { by: probe:npm-public-package-version-live-20260826, at: 2026-08-26T18:06:14Z }
status: stable
stale_after: 2026-09-02T18:06:14Z
sources:
  - id: subject
    resource: ../../platforms/npm-public-registry.md
    title: npm Public Registry
    author: organization:npm
  - id: npm-view
    resource: https://docs.npmjs.com/cli/v11/commands/npm-view/
    title: npm view · View registry info
    author: organization:npm
  - id: live-report
    resource: ../../verifications/npm/public-package-version/report.json
    title: Live verification report
    author: probe:npm-public-package-version-live
capability:
  id: npm.registry.read-public-package-version
  version: 1.0.0
  subjectRef: /platforms/npm-public-registry.md
  kind: query
  effect: none
  inputSchema: /schemas/npm/read-public-package-version-input.schema.json
  outputSchema: /schemas/npm/read-public-package-version-output.schema.json
  resultConcepts: [/concepts/npm/public-package-version-metadata.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅读取公共 Registry 中的精确版本；元数据与 tarball 仍受 npm 条款、包许可证、作者权利、撤回和删除状态约束。不得把 license 字段当作独立授权结论。
verification:
  level: live
  report: /verifications/npm/public-package-version/report.json
---

# 读取 npm 公共包精确版本元数据

输入只接受小写 npm package name（含合法 scope）和精确 semver。Connector 固定访问 `https://registry.npmjs.org`，不接受 tag、range、alternate registry、重定向或凭据；单次响应上限为 1 MiB，HTTP 失败不自动重试。

输出只保留包名、版本、描述、license/deprecation 声明、repository、engines、Registry tarball URL、SHA-512 SRI、SHA-1 shasum、观测时间和结果摘要。身份不匹配、SRI/shasum 缺失、tarball 逃逸公共 Registry、响应超限或字段结构漂移都会失败。

该能力适合在开源项目调研中核验“某个精确包版本在公共 Registry 中存在、声明了什么元数据、其发行物身份是什么”。它不下载或执行包，也不证明许可证、安全、维护质量、来源仓库与发行 tarball 一致或项目 Capability 可用。

- [输入 Schema](../../schemas/npm/read-public-package-version-input.schema.json)
- [输出 Schema](../../schemas/npm/read-public-package-version-output.schema.json)
- [验证报告](../../verifications/npm/public-package-version/report.json)

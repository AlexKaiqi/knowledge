---
type: Capability
title: 读取 NuGet.org 公共包精确版本证据
description: 经 NuGet.org 官方 V3 service index 读取一个精确包版本的最小 Registration 元数据，并下载有界 nupkg 计算内容摘要。
tags: [nuget, dotnet, package-version, nupkg, integrity, official-api]
generated: { by: connector:nuget-org-public-package-version, at: 2026-08-26T22:04:12Z }
verified:
  - { by: probe:nuget-org-public-package-version-live-20260826, at: 2026-08-26T22:04:12Z }
status: stable
stale_after: 2026-09-02T22:04:12Z
sources:
  - id: subject
    resource: ../../platforms/nuget-org.md
    title: NuGet.org
    author: organization:microsoft
  - id: api-overview
    resource: https://learn.microsoft.com/en-us/nuget/api/overview
    title: Overview of the NuGet Server API
    author: organization:microsoft
  - id: registration
    resource: https://learn.microsoft.com/en-us/nuget/api/registration-base-url-resource
    title: Package Metadata, NuGet API
    author: organization:microsoft
  - id: package-content
    resource: https://learn.microsoft.com/en-us/nuget/api/package-base-address-resource
    title: Package Content, NuGet API
    author: organization:microsoft
  - id: live-report
    resource: ../../verifications/nuget-org/public-package-version/report.json
    title: Live verification report
    author: probe:nuget-org-public-package-version-live
capability:
  id: nuget-org.packages.read-public-version-evidence
  version: 1.0.0
  subjectRef: /platforms/nuget-org.md
  kind: query
  effect: none
  inputSchema: /schemas/nuget-org/read-public-package-version-evidence-input.schema.json
  outputSchema: /schemas/nuget-org/read-public-package-version-evidence-output.schema.json
  resultConcepts: [/concepts/nuget-org/public-package-version-evidence.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅读取 NuGet.org 公共精确版本及最多 32 MiB 的包字节。许可证、项目、弃用和漏洞字段仍是发布/仓库声明；包内容及其使用继续受权利人、平台政策与适用法律约束。
verification:
  level: live
  report: /verifications/nuget-org/public-package-version/report.json
---

# 读取 NuGet.org 公共包精确版本证据

输入只接受 Package ID 和 Connector 支持的精确规范化 NuGet version 子集；拒绝 range、floating/latest、build metadata、alternate feed 和未知字段。Connector 每次从 `https://api.nuget.org/v3/index.json` 发现 Registration 与 Package Content 资源；只允许 `api.nuget.org → nuget.azure.cn` 的单次同路径 HTTPS 重定向。

Registration index/page 合计上限 4 MiB、64 pages；`.nupkg` 上限 32 MiB、4096 ZIP entries。输出保留有界元数据、实际字节的 SHA-256/SHA-512、可选 server SHA-512 一致性、ZIP 结构摘要和签名 entry 存在性；不输出作者/owner、描述、依赖、漏洞链接或 raw payload。

能力会下载但不解压、安装或执行包，也不进行依赖求解。它不验证 NuGet CMS 签名，不证明安全、许可证、来源构建或漏洞完整性。429/403/404 按阶段返回 typed error，不自动重试。

- [输入 Schema](../../schemas/nuget-org/read-public-package-version-evidence-input.schema.json)
- [输出 Schema](../../schemas/nuget-org/read-public-package-version-evidence-output.schema.json)
- [验证报告](../../verifications/nuget-org/public-package-version/report.json)

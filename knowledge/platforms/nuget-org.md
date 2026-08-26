---
type: Platform
title: NuGet.org
description: .NET 的公共包仓库；当前只准入按精确 Package ID 和规范化版本读取最小元数据并下载、哈希有界 nupkg 的能力。
tags: [nuget, dotnet, package-registry, nupkg, integrity]
generated: { by: connector:nuget-org-public-package-version, at: 2026-08-26T22:04:12Z }
verified:
  - { by: probe:nuget-org-public-package-version-live-20260826, at: 2026-08-26T22:04:12Z }
status: stable
stale_after: 2026-09-02T22:04:12Z
sources:
  - id: overview
    resource: https://learn.microsoft.com/en-us/nuget/nuget-org/overview-nuget-org
    title: Overview of NuGet.org
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
  - id: deletion-policy
    resource: https://learn.microsoft.com/en-us/nuget/nuget-org/policies/deleting-packages
    title: Deleting NuGet Packages from nuget.org
    author: organization:microsoft
  - id: signed-packages
    resource: https://learn.microsoft.com/en-us/nuget/reference/signed-packages-reference
    title: Signed Packages
    author: organization:microsoft
  - id: live-report
    resource: ../verifications/nuget-org/public-package-version/report.json
    title: Public package version live verification report
    author: probe:nuget-org-public-package-version-live
---

# NuGet.org

NuGet.org 是 .NET 的公共包仓库。当前 catalog 只验证了无需账号、按调用者已知的精确 Package ID 和规范化版本读取 Registration 元数据，并完整下载不超过 32 MiB 的 `.nupkg` 形成内容证据。

Connector 从官方 service index 发现 `RegistrationsBaseUrl/3.6.0` 和 `PackageBaseAddress/3.0.0`，而不是把当前资源 URL 当永久常量。当前网络位置会把 `api.nuget.org` 逐请求 302 到 `nuget.azure.cn`；Connector 只接受这一条 HTTPS、同 path/query、至多一次的已观测路由，不把镜像域名暴露成第二个产品数据源。

输出包含规范化包身份、listed/published、minimum client、许可证声明、项目 URL、去正文的 deprecation、按 severity 聚合的漏洞数量，以及实际 `.nupkg` 的大小、SHA-256、SHA-512、ZIP 中央目录摘要、manifest/signature entry。作者、owner、描述、依赖图、advisory URL、下载量和原始 JSON/包内容不进入结果。

未验证范围：搜索、版本枚举、range/latest 解析、超过 32 MiB 的包、依赖求解、安装、执行、源码对应关系、安全或许可证审计、私有 feed、账号、发布、unlist/deprecate 和删除。NuGet.org 通常用 unlist 保持精确恢复，但政策允许极少数删除；精确 ID/version 不能被描述成绝对永久。

- [读取公共包精确版本证据](../capabilities/nuget-org/read-public-package-version-evidence.md)

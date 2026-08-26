---
type: Concept
title: NuGet.org 公共包精确版本证据
description: 由精确包 ID、规范化版本、Registration 元数据和实际 nupkg 字节的本地摘要构成的有界发布证据。
tags: [nuget, package-version, nupkg, sha512, repository-signature]
generated: { by: connector:nuget-org-public-package-version, at: 2026-08-26T22:04:12Z }
verified:
  - { by: probe:nuget-org-public-package-version-live-20260826, at: 2026-08-26T22:04:12Z }
status: stable
stale_after: 2026-09-02T22:04:12Z
sources:
  - id: platform
    resource: ../../platforms/nuget-org.md
    title: NuGet.org
    author: organization:microsoft
  - id: registration
    resource: https://learn.microsoft.com/en-us/nuget/api/registration-base-url-resource
    title: Package Metadata, NuGet API
    author: organization:microsoft
  - id: versioning
    resource: https://learn.microsoft.com/en-us/nuget/concepts/package-versioning
    title: NuGet Package Version Reference
    author: organization:microsoft
  - id: live-snapshot
    resource: ../../verifications/nuget-org/public-package-version/snapshot.json
    title: Normalized live observation
    author: connector:nuget-org-public-package-version
---

# NuGet.org 公共包精确版本证据

该概念绑定调用者给出的精确 Package ID 与 Connector 支持的规范化 NuGet version 子集。Registration leaf 负责包身份、状态和最小声明；`packageContent` 指向的 `.nupkg` 会完整下载并在本地计算 SHA-256/SHA-512。

Connector 只扫描 ZIP 中央目录，不解压文件：确认唯一根级 `.nuspec` 与 `.signature.p7s`、条目数、声明解压总量和中央目录摘要。`signaturePresent: true` 只说明签名 entry 存在且有界；`signatureCryptographicallyVerified: false` 明确说明没有验证 CMS 签名、证书链、时间戳或 repository trust policy。

license expression、deprecation 与 vulnerability counts 都是仓库元数据。它们不能证明许可证成立、漏洞集合完整、包安全、源码与二进制对应，或调用者已取得使用权。

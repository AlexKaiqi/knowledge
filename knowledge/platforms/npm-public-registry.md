---
type: Platform
title: npm Public Registry
description: npm 的公共 JavaScript 包注册表；当前只准入按精确版本读取经最小化的公共包元数据。
tags: [npm, registry, packages, javascript, public-metadata]
generated: { by: connector:npm-public-package-version, at: 2026-08-26T18:06:14Z }
verified:
  - { by: probe:npm-public-package-version-live-20260826, at: 2026-08-26T18:06:14Z }
status: stable
stale_after: 2026-09-02T18:06:14Z
sources:
  - id: public-registry
    resource: https://docs.npmjs.com/about-the-public-npm-registry/
    title: About the public npm registry
    author: organization:npm
  - id: registry-contract
    resource: https://docs.npmjs.com/cli/v11/using-npm/registry/
    title: Registry · npm Docs
    author: organization:npm
  - id: npm-view
    resource: https://docs.npmjs.com/cli/v11/commands/npm-view/
    title: npm view · View registry info
    author: organization:npm
  - id: open-source-terms
    resource: https://docs.npmjs.com/policies/open-source-terms
    title: npm Open Source Terms
    author: organization:npm
  - id: live-report
    resource: ../verifications/npm/public-package-version/report.json
    title: Public package version live verification report
    author: probe:npm-public-package-version-live
---

# npm Public Registry

npm Public Registry 是 JavaScript 软件包及其元数据的公共注册表。当前 catalog 只验证了无需账号读取一个公开包的精确已发布版本；固定使用 `https://registry.npmjs.org`，不接受调用者指定的 registry。

已验证范围：精确小写 package name 与精确 semver、包名和版本身份、description、license 声明、deprecation、repository、engines，以及发行 tarball 的 SHA-512 SRI、SHA-1 shasum 和固定 Registry URL。输出不包含 author、maintainers、contributors、邮箱、原始响应或服务端 Cookie。

未验证范围：tag/range 解析、包搜索、全量枚举、tarball 下载或执行、依赖解析、安全审计、provenance、私有包、账号、发布、废弃、撤回和所有写操作。Registry 返回 `license` 只是发布元数据，不证明许可证文件存在、声明有效或调用者获得特定使用权；完整性摘要也不证明包安全。

- [读取公共包精确版本元数据](../capabilities/npm/read-public-package-version.md)

---
type: Concept
title: npm 公共包版本元数据
description: npm Public Registry 中由精确 package name 和精确 semver 标识的最小化版本元数据与发行完整性信息。
tags: [npm, package, version, metadata, integrity]
generated: { by: connector:npm-public-package-version, at: 2026-08-26T18:06:14Z }
verified:
  - { by: probe:npm-public-package-version-live-20260826, at: 2026-08-26T18:06:14Z }
status: stable
stale_after: 2026-09-02T18:06:14Z
sources:
  - id: platform
    resource: ../../platforms/npm-public-registry.md
    title: npm Public Registry
    author: organization:npm
  - id: live-snapshot
    resource: ../../verifications/npm/public-package-version/snapshot.json
    title: Normalized live observation
    author: connector:npm-public-package-version
---

# npm 公共包版本元数据

该概念表示一个精确 npm package version 的有界投影，包括包名、版本、描述、许可证声明、废弃声明、源码仓库、运行时约束，以及 tarball URL、SHA-512 SRI 和 SHA-1 shasum。

精确版本避免把会移动的 dist-tag 或 semver range 隐藏在调用中，但 npm 仍可能更新 deprecation 等管理元数据或按政策撤回内容。因此发行完整性变化、许可证变化和不可达都必须由 Collector 提案复审，不能静默改写基线。

该投影有意排除 author、maintainers、contributors 和邮箱。`license`、`repository` 与 `engines` 均为发布者声明；它们不是独立审计结论。tarball 摘要只用于内容身份校验，不表示已下载、已执行、安全或可合法采用。

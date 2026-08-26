---
type: Concept
title: GitHub 公共仓库 Release
description: GitHub 公共仓库中按精确 tag 标识的非草稿 release、受限说明摘要和内嵌资产元数据快照。
tags: [github, repository, release, asset, integrity]
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
---

# GitHub 公共仓库 Release

一个 Release 由请求仓库和精确 tag 定位。结果只包含 release 身份、目标分支或 commitish、名称、预发布与 immutable 标记、创建/发布时间、GitHub 页面、受限说明，以及最多 64 个内嵌资产的名称、状态、内容类型、大小、GitHub 下载地址、时间和可选 SHA-256。

`assetCoverage.completeness: not-asserted` 表示 Connector 只观察 API 响应内嵌的资产数组，并未用独立分页接口证明资产集合完整。`sha256: null` 表示 GitHub 没有提供摘要；不能推导资产不变或安全。Connector 不下载、重算、解压或执行资产。

Release 说明可能包含第三方文本、Cookie 等技术词汇；数据最小化约束针对输出字段，不得误删合法说明内容，也不得因此引入 author、uploader、头像或下载计数。

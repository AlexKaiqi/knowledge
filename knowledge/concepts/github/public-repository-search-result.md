---
type: Concept
title: GitHub 公共仓库搜索结果
description: GitHub 官方仓库搜索 API 对一次查询返回的有界排序分页及其覆盖、限流和仓库元数据。
tags: [github, repository, ranked-page, coverage]
generated: { by: connector:github-public-repository-search, at: 2026-08-26T17:13:25Z }
verified:
  - { by: probe:github-public-repository-search-live-20260826, at: 2026-08-26T17:13:25Z }
status: stable
stale_after: 2026-09-02T17:13:25Z
sources:
  - id: platform
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-snapshot
    resource: ../../verifications/github/public-repository-search/snapshot.json
    title: Normalized live observation
    author: connector:github-public-repository-search
---

# GitHub 公共仓库搜索结果

该概念表示一个 `ranked-page`，不是仓库目录或生态清单。它包含原始查询、排序和分页参数、API 报告的总数、本次返回数、`incompleteResults`、可访问结果窗口、是否耗尽当前窗口，以及规范化公共仓库摘要。

`pageExhausted: true` 只表示当前查询在 GitHub 可访问窗口中没有下一页；`ecosystemComplete` 固定为 `false`。关键词缺失、索引延迟、排名截断、结果上限和 API 不完整响应都会造成缺失。

仓库 `licenseSpdx` 来自 API 当前元数据。`null` 表示 API 没有返回 SPDX 标识，不代表公共领域，也不授予复制、修改或分发许可。

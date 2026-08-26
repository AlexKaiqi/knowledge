---
type: Platform
title: GitHub
description: 当前仅准入了通过官方 REST API 搜索公共仓库排序分页的能力；其它 GitHub 能力分别验证。
tags: [github, developer-platform, public-repositories]
generated: { by: connector:github-public-repository-search, at: 2026-08-26T17:13:25Z }
verified:
  - { by: probe:github-public-repository-search-live-20260826, at: 2026-08-26T17:13:25Z }
status: stable
stale_after: 2026-09-02T17:13:25Z
sources:
  - id: repository-search-api
    resource: "https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10#search-repositories"
    title: REST API endpoints for search · Search repositories
    author: organization:github
  - id: api-rate-limits
    resource: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
    title: Rate limits for the REST API
    author: organization:github
  - id: api-versions
    resource: https://docs.github.com/en/rest/about-the-rest-api/api-versions
    title: API Versions
    author: organization:github
  - id: api-terms
    resource: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
    title: GitHub Terms of Service · API Terms
    author: organization:github
  - id: live-report
    resource: ../verifications/github/public-repository-search/report.json
    title: Public repository search live verification report
    author: probe:github-public-repository-search-live
---

# GitHub

当前 catalog 只准入通过 GitHub 官方 REST API 搜索公共仓库的能力。未登录请求可以读取公共数据，但受独立的 Search 限流桶约束；Connector 不通过共享 token 绕过限流，也不在限流后自动重试。

已验证范围：固定 API 版本 `2026-03-10`，按用户提供的查询词返回一个有上限的排序分页，并保留 `incomplete_results`、Search rate-limit headers 和 1,000 条结果窗口边界。

未验证范围：私有仓库、代码搜索、Issues、Pull Requests、写操作、组织管理、用户画像收集和全生态枚举。GitHub 搜索结果受查询词、排名、索引和窗口限制；即使一页耗尽，也不能推导为“开源生态完整”。

根据 GitHub API Terms 和 Acceptable Use Policies，这条能力禁止用于垃圾信息、出售个人信息或规避限流。输出只保留有界的公共仓库元数据，不采集邮箱或个人资料，并应响应删除与权利变更。

- [搜索公共仓库](../capabilities/github/search-public-repositories.md)

---
type: Platform
title: GitHub
description: 当前准入了通过官方 REST API 搜索公共仓库，以及在完整 commit ID 下读取有界公共仓库文件的能力；其它 GitHub 能力分别验证。
tags: [github, developer-platform, public-repositories, repository-contents]
generated: { by: connector:github-public-repository-file, at: 2026-08-26T17:54:29Z }
verified:
  - { by: probe:github-public-repository-search-live-20260826, at: 2026-08-26T17:13:25Z }
  - { by: probe:github-public-repository-file-live-20260826, at: 2026-08-26T17:54:29Z }
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
  - id: repository-contents-api
    resource: https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10#get-repository-content
    title: REST API endpoints for repository contents · Get repository content
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
  - id: repository-file-live-report
    resource: ../verifications/github/public-repository-file/report.json
    title: Public repository file live verification report
    author: probe:github-public-repository-file-live
---

# GitHub

当前 catalog 准入两项通过 GitHub 官方 REST API、无需登录的公共读取能力：搜索公共仓库排序分页，以及在完整不可变 commit ID 下读取一个有界 UTF-8 仓库文件。Connector 不通过共享 token 绕过限流，也不在限流后自动重试。

已验证范围：固定 API 版本 `2026-03-10`；搜索能力按用户查询返回有上限的排序分页，并保留 `incomplete_results`、Search 限流和 1,000 条结果窗口；文件能力只接受完整 commit ID、单个不超过 256 KiB 的 UTF-8 文件，并返回 Git blob ID、正文 SHA-256 和 `core` 限流状态。

未验证范围：私有仓库、目录枚举、Git LFS、代码搜索、Issues、Pull Requests、写操作、组织管理、用户画像收集和全生态枚举。GitHub 搜索结果受查询词、排名、索引和窗口限制；即使一页耗尽，也不能推导为“开源生态完整”。公开文件可读也不等于具有复制、修改、再分发或商用许可。

根据 GitHub API Terms 和 Acceptable Use Policies，这条能力禁止用于垃圾信息、出售个人信息或规避限流。输出只保留有界的公共仓库元数据，不采集邮箱或个人资料，并应响应删除与权利变更。

- [搜索公共仓库](../capabilities/github/search-public-repositories.md)
- [读取公共仓库文件](../capabilities/github/read-public-repository-file.md)

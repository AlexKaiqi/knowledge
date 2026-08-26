---
type: Concept
title: GitHub 公共仓库 Tag 集合
description: GitHub 官方仓库 Tags API 返回的有界 tag 名称与目标 commit 身份快照，以及显式完整性边界。
tags: [github, repository, git-tag, release-observation]
generated: { by: connector:github-public-repository-tags, at: 2026-08-26T19:04:40Z }
verified:
  - { by: probe:github-public-repository-tags-live-20260826, at: 2026-08-26T19:04:40Z }
status: stable
stale_after: 2026-09-02T19:04:40Z
sources:
  - id: platform
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-snapshot
    resource: ../../verifications/github/public-repository-tags/snapshot.json
    title: Normalized live tag observation
    author: connector:github-public-repository-tags
---

# GitHub 公共仓库 Tag 集合

该概念表示一个公共仓库在某次观测时的有界 tag 快照。每项只包含 tag 名称和 GitHub Tags API 投影的目标 commit SHA；结果按 tag 名排序，并以 `refs/tags/<name>\t<commitSha>` 生成集合摘要。

`tagSetComplete: true` 只表示 Connector 在本次请求预算内走到官方分页终点。`false` 表示结果被 `maxTags` 截断，不能用来断言仓库没有其它 tag。仓库可在分页期间变化；重复 tag 名会使本次观测失败，而不是静默合并。

集合摘要用于检测变化，不是签名、透明日志证明、发行物完整性或版本语义证明。输出不包含 tagger、邮箱、tag message、签名、archive URL 或原始 API payload。

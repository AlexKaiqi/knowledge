---
type: Concept
title: GitHub 公共仓库 Work Item 变更集
description: 一个 GitHub 公共仓库在复合 checkpoint 之后的有界 issue/pull-request 变化投影。
tags: [github, issue, pull-request, work-item, checkpoint, incremental]
generated: { by: connector:github-public-repository-work-item-changes, at: 2026-08-26T23:06:42Z }
verified:
  - { by: probe:github-public-repository-work-item-changes-live-20260826, at: 2026-08-26T23:06:42Z }
status: stable
stale_after: 2026-09-02T23:06:42Z
sources:
  - { id: platform, resource: ../../platforms/github.md, title: GitHub, author: organization:github }
  - { id: issues-api, resource: "https://docs.github.com/en/rest/issues/issues?apiVersion=2026-03-10", title: REST API endpoints for issues, author: organization:github }
  - { id: pagination, resource: "https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2026-03-10", title: Using pagination in the REST API, author: organization:github }
  - { id: snapshot, resource: ../../verifications/github/public-repository-work-item-changes/snapshot.json, title: Public work-item change live snapshot, author: connector:github-public-repository-work-item-changes }
---

# GitHub 公共仓库 Work Item 变更集

Work Item 的原生身份是明确的公共 repository 加 issue number。GitHub Issues endpoint 同时返回 issue 与 pull request，因此该概念显式保留 `kind`；其中 pull-request number 仍是 Issues API 的 issue identity，不冒充 Pull Requests API 的独立 ID 或完整 PR 对象。

每个条目保留公开 URL、state/state reason、标题、label 名、评论数量、locked 和生命周期时间。Body 只保留是否存在、Unicode 长度与 SHA-256；作者、用户、assignee、邮箱、头像、评论正文、timeline 与 raw payload 不属于该投影。

变更集通过 `updatedAt + 同秒 number/changeDigest` 复合 checkpoint 恢复。Connector 会重读边界前一秒并过滤未变化的同秒项，从而减少单纯时间戳造成的遗漏；截断窗口只把 checkpoint 推进到实际返回项。

这不是不可变事件日志。翻页期间可发生并发更新，时间戳只有秒级，超过资源预算的同秒变化或一秒内多次更新仍可能无法重建全部中间状态。`complete` 只说明当前有界 API 页已耗尽，不代表 GitHub 历史完整、未来无变化或每次修改都被捕获。

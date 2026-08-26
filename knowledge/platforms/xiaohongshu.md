---
type: Platform
title: 小红书
description: 当前仅准入了通过自有账号会话读取本人笔记列表的能力；其它平台能力分别验证。
tags: [xiaohongshu, social-platform, owned-account]
generated: { by: connector:xiaohongshu-browser, at: 2026-08-26T16:43:43Z }
verified:
  - { by: probe:xiaohongshu-owned-notes-live-20260826, at: 2026-08-26T16:43:43Z }
status: stable
stale_after: 2026-09-02T16:43:43Z
sources:
  - id: official-community-rules
    resource: https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4
    title: 小红书社区公约
    author: organization:xiaohongshu
  - id: integration-research
    resource: repo:/docs/research/xiaohongshu-integration.md
    title: 小红书接入调研与第一条能力纵切
    author: team:dsh
  - id: live-read-report
    resource: ../verifications/xiaohongshu/owned-notes/report.json
    title: Owned notes live verification report
    author: probe:xiaohongshu-owned-notes-live
---

# 小红书

当前 catalog 对小红书只作能力级声明，不把“平台已接入”当作一个笼统布尔值。

已验证范围：使用用户明确请求接入的本地自有账号会话，通过 browser-assisted Connector 读取本人主页的笔记列表，并只返回笔记 ID、标题和稳定详情 URL。列表为空是合法结果；当前 live probe 实际观测到 0 条。

未验证范围：笔记发布、删除、公开搜索、第三方内容采集、互动、私信、广告、电商和创作者数据等。私密发布 Connector 仍是 candidate，不能因为读取能力通过就自动升级。

Credential、Cookie、浏览器 profile、`xsec_token` 和实际账号身份留在仓库外；公开知识与验证证据只保存能力契约、结构检查和脱敏结论。

- [读取本人笔记](../capabilities/xiaohongshu/list-owned-notes.md)
- [小红书账号开放平台 API 信息源](../sources/xiaohongshu-account-api.md)

---
type: Information Source
title: 小红书账号开放平台 API 参考
description: 小红书官方公开的账号授权 API 接口目录与安全约束。
tags: [xiaohongshu, official, oauth, api-reference]
generated: { by: connector:xiaohongshu-account-docs, at: 2026-08-26T16:35:24Z }
verified:
  - { by: probe:xiaohongshu-account-api-live-20260826, at: 2026-08-26T16:35:24Z }
status: stable
stale_after: 2026-09-02T16:35:24Z
sources:
  - id: official-reference
    resource: https://openaccount.xiaohongshu.com/docs/api-reference
    title: API 参考 · 小红书开放平台
    author: organization:xiaohongshu
  - id: live-snapshot
    resource: ../verifications/xiaohongshu/account-api/snapshot.json
    title: Normalized live observation
    author: connector:xiaohongshu-account-docs
---

# 小红书账号开放平台 API 参考

这是一个无需登录即可读取的官方信息源。当前参考页声明 10 个账号授权相关接口，生产 Base URL 为 `https://openaccount.xiaohongshu.com`，测试环境为 `https://openaccount.beta.xiaohongshu.com`，接口使用 POST JSON。

该参考页覆盖 OAuth 授权、PKCE、token 生命周期、最小用户信息、授权应用管理和 Device Flow。它当前没有声明笔记发布、本人笔记列表或笔记反馈接口；“未声明”只描述该参考页的边界，不等于平台不存在相关产品能力。

读取此信息源不需要账号或凭据。真正调用页面中列出的授权 API 时，仍须遵循各接口的应用凭据、用户授权和服务端安全要求。

- [结构化读取能力](../capabilities/xiaohongshu/read-account-api-surface.md)
- [账号 API 接口面概念](../concepts/xiaohongshu/account-api-surface.md)
- [最新验证报告](../verifications/xiaohongshu/account-api/report.json)

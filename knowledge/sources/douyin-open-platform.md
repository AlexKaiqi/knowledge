---
type: Information Source
title: 抖音开放平台官方文档
description: 抖音官方公开的授权、OpenAPI 能力目录、内容发布与安全边界文档集合。
tags: [douyin, official, oauth, openapi]
generated: { by: connector:douyin-open-platform-docs, at: 2026-08-26T17:05:32Z }
verified:
  - { by: probe:douyin-open-platform-docs-live-20260826, at: 2026-08-26T17:05:32Z }
status: stable
stale_after: 2026-09-02T17:05:32Z
sources:
  - id: openapi-list
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/list/
    title: OpenAPI 列表
    author: organization:douyin
  - id: publishing-solution
    resource: https://open.douyin.com/platform/resource/docs/ability/content-management/douyin-publish-solution/
    title: 抖音内容发布接入方案
    author: organization:douyin
  - id: oauth-overview
    resource: https://open.douyin.com/platform/resource/docs/develop/permission/overall-permission
    title: 总体授权说明
    author: organization:douyin
  - id: access-token
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/account-permission/get-access-token/
    title: 获取 access_token
    author: organization:douyin
  - id: create-video
    resource: https://open.douyin.com/platform/resource/docs/openapi/video-management/douyin/create/create-video
    title: 创建视频
    author: organization:douyin
  - id: live-snapshot
    resource: ../verifications/douyin/open-platform/snapshot.json
    title: Normalized live observation
    author: connector:douyin-open-platform-docs
---

# 抖音开放平台官方文档

这是一个无需登录即可读取的官方信息源集合。当前规范化接口面覆盖 OAuth 授权、用户公开资料、内容、搜索、数据开放服务、内容发布和授权账号内容管理等文档能力族。

文档同时声明：真实业务调用可能要求应用审核、scope 申请和用户授权；`access_token` 建议保存在服务端；代用户创建视频除授权外，每次调用都必须让用户明确感知。

这条知识只证明官方文档当前可访问、可解析，不能证明本仓库已有获批应用、凭据、scope 或授权用户，也不能证明任何抖音业务操作当前可调用。

- [结构化读取能力](../capabilities/douyin/read-open-platform-surface.md)
- [开放平台能力接口面概念](../concepts/douyin/open-platform-capability-surface.md)
- [最新验证报告](../verifications/douyin/open-platform/report.json)

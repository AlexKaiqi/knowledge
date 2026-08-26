---
type: Platform
title: 抖音
description: 当前只准入了无需身份、按明确 VideoID 读取公开视频嵌入描述的官方 API 能力；其它平台操作分别验证。
tags: [douyin, social-platform, public-video, embed]
generated: { by: connector:douyin-public-video-embed, at: 2026-08-26T20:56:39Z }
verified:
  - { by: probe:douyin-public-video-embed-live-20260826, at: 2026-08-26T20:56:39Z }
status: stable
stale_after: 2026-09-02T20:56:39Z
sources:
  - id: official-iframe-api
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/iframe-player/get-iframe-by-video
    title: 通过 VideoID 获取 IFrame 代码
    author: organization:douyin
  - id: official-openapi-list
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/list/
    title: 抖音开放平台 OpenAPI 列表
    author: organization:douyin
  - id: live-report
    resource: ../verifications/douyin/public-video-embed/report.json
    title: Public video embed live verification report
    author: probe:douyin-public-video-embed-live
---

# 抖音

当前 catalog 对抖音只作能力级声明。已验证范围是：无需账号、凭据、scope 或用户授权，按明确 VideoID 调用官方开放平台接口，读取公开标题、画面宽高和受约束的官方播放器 URL。

Connector 会丢弃上游原始 iframe HTML 和平台日志，只返回安全的最小投影。该调用没有平台写入、通信、身份关系或财务副作用；也没有伪装 Googlebot、复用浏览器 Cookie、计算内部 Web 签名或调用已失效的 `iesdouyin` 分享页解析路线。

未验证范围：公开视频搜索与批量采集、作者或互动数据、评论、媒体下载、创作者中心、自有账号分析、OAuth 业务能力、草稿、发布、删除、私信、电商和广告。官方开放平台文档已作为独立 Information Source 准入，但文档存在不等于这些业务操作已可调用。

- [读取公开视频嵌入描述](../capabilities/douyin/read-public-video-embed.md)
- [抖音开放平台官方文档](../sources/douyin-open-platform.md)

---
type: Capability
title: 读取抖音公开视频嵌入描述
description: 按明确 VideoID 调用无需申请权限的官方接口，返回经过约束的标题、画面尺寸和官方播放器 URL。
tags: [douyin, query, public-video, official-api, embed]
outcomes: [product-research, distribution]
generated: { by: connector:douyin-public-video-embed, at: 2026-08-26T20:56:39Z }
verified:
  - { by: probe:douyin-public-video-embed-live-20260826, at: 2026-08-26T20:56:39Z }
status: stable
stale_after: 2026-09-02T20:56:39Z
sources:
  - id: subject
    resource: ../../platforms/douyin.md
    title: 抖音
    author: organization:douyin
  - id: official-iframe-api
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/iframe-player/get-iframe-by-video
    title: 通过 VideoID 获取 IFrame 代码
    author: organization:douyin
  - id: live-report
    resource: ../../verifications/douyin/public-video-embed/report.json
    title: Public video embed live verification report
    author: probe:douyin-public-video-embed-live
capability:
  id: douyin.public-video.read-embed
  version: 1.0.0
  subjectRef: /platforms/douyin.md
  kind: query
  effect: none
  inputSchema: /schemas/douyin/read-public-video-embed-input.schema.json
  outputSchema: /schemas/douyin/read-public-video-embed-output.schema.json
  resultConcepts: [/concepts/douyin/public-video-embed-descriptor.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 官方文档明确该接口无需申请权限；Connector 不使用账号、Cookie、client token、access token、签名或爬虫身份伪装。
verification:
  level: live
  report: /verifications/douyin/public-video-embed/report.json
---

# 读取抖音公开视频嵌入描述

输入是明确的十进制 `videoId` 字符串。Connector 固定调用抖音开放平台官方 `GET /api/douyin/v1/video/get_iframe_by_video`，一次 operation 只发起一次请求，不跟随重定向、不自动重试，并限制响应为 64 KiB JSON。

输出只包含请求 VideoID、公开标题、视频画面宽高和经过 origin/path/identity/参数校验后重建的官方播放器 URL。原始 iframe HTML、平台日志 ID、作者身份、互动指标、评论、媒体地址、Cookie、token 与 raw payload 均不返回。

这项能力只证明该 VideoID 当前可由官方嵌入接口解析；不证明视频长期存在、版权或使用授权、作者身份、内容安全、播放在所有地区/客户端可用，也不提供搜索、下载、评论或发布。

- [输入 Schema](../../schemas/douyin/read-public-video-embed-input.schema.json)
- [输出 Schema](../../schemas/douyin/read-public-video-embed-output.schema.json)
- [验证报告](../../verifications/douyin/public-video-embed/report.json)

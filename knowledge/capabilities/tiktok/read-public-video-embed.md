---
type: Capability
title: 读取 TikTok 公共视频嵌入描述
description: 按明确 canonical public video URL 调用官方 oEmbed，返回最小 VideoID、标题和缩略图尺寸。
tags: [tiktok, query, public-video, official-api, embed]
outcomes: [product-research, distribution]
generated: { by: connector:tiktok-public-video-embed, at: 2026-08-27T12:59:43Z }
verified:
  - { by: probe:tiktok-public-video-embed-live-20260827, at: 2026-08-27T12:59:43Z }
status: stable
stale_after: 2026-09-03T12:59:43Z
sources:
  - id: subject
    resource: ../../platforms/tiktok.md
    title: TikTok
    author: organization:tiktok
  - id: official-embed-videos
    resource: https://developers.tiktok.com/docs/en/embed-videos
    title: Embed Videos
    author: organization:tiktok
  - id: live-report
    resource: ../../verifications/tiktok/public-video-embed/report.json
    title: Public video oEmbed live verification report
    author: probe:tiktok-public-video-embed-live
capability:
  id: tiktok.public-video.read-embed
  version: 1.0.0
  subjectRef: /platforms/tiktok.md
  kind: query
  effect: none
  inputSchema: /schemas/tiktok/read-public-video-embed-input.schema.json
  outputSchema: /schemas/tiktok/read-public-video-embed-output.schema.json
  resultConcepts: [/concepts/tiktok/public-video-embed-descriptor.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 官方 oEmbed 文档提供无需账号的公共 URL 调用；Connector 不使用账号、Cookie、API key、OAuth、签名或爬虫身份伪装。
verification:
  level: live
  report: /verifications/tiktok/public-video-embed/report.json
---

# 读取 TikTok 公共视频嵌入描述

输入必须是精确 `https://www.tiktok.com/@handle/video/{videoId}` URL，不接受短链、查询参数、重定向或自定义 origin。Connector 固定调用 `GET https://www.tiktok.com/oembed`，一次 operation 只发起一次请求，不跟随重定向、不重试，并限制响应为 128 KiB JSON。

输出只包含 VideoID、canonical URL、公开标题和缩略图尺寸。作者身份、原始 embed HTML、缩略图 URL、互动指标、评论、媒体内容、Cookie、token 和 raw payload 均不返回。

这项能力只证明该明确视频在探测时可被官方 oEmbed 描述；不证明搜索能力、作者身份、版权、长期存在、内容安全、地区播放、需求规模或传播影响力。

- [输入 Schema](../../schemas/tiktok/read-public-video-embed-input.schema.json)
- [输出 Schema](../../schemas/tiktok/read-public-video-embed-output.schema.json)
- [验证报告](../../verifications/tiktok/public-video-embed/report.json)

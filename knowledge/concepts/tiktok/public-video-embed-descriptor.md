---
type: Concept
title: TikTok Public Video Embed Descriptor
description: 一个明确 TikTok 公共视频 URL 对应的最小 VideoID、标题与缩略图尺寸投影。
tags: [tiktok, public-video, embed, metadata]
generated: { by: connector:tiktok-public-video-embed, at: 2026-08-27T12:59:43Z }
verified:
  - { by: probe:tiktok-public-video-embed-live-20260827, at: 2026-08-27T12:59:43Z }
status: stable
stale_after: 2026-09-03T12:59:43Z
sources:
  - id: platform
    resource: ../../platforms/tiktok.md
    title: TikTok
    author: organization:tiktok
  - id: official-embed-videos
    resource: https://developers.tiktok.com/docs/en/embed-videos
    title: Embed Videos
    author: organization:tiktok
  - id: live-snapshot
    resource: ../../verifications/tiktok/public-video-embed/snapshot.json
    title: Normalized live observation
    author: connector:tiktok-public-video-embed
---

# TikTok Public Video Embed Descriptor

该概念表示一个明确 canonical URL 对应的最小公开视频证据：VideoID、canonical URL、公开视频标题和缩略图宽高。它适合在调研中确认“这条公开视频当下仍可由官方描述”，但不提供搜索、作者画像、影响力指标或内容版权判断。

上游 oEmbed 还返回作者、可注入 HTML 和缩略图 URL。Connector 用这些字段验证来源与 VideoID 后立即丢弃，不把作者身份、HTML、图片地址、媒体、评论或 raw payload 暴露为知识。

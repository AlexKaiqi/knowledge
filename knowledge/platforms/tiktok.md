---
type: Platform
title: TikTok
description: 当前只准入了按明确公开视频 URL 读取官方 oEmbed 最小描述的能力；搜索、自有账号读取和发布分别验证。
tags: [tiktok, social-platform, public-video, embed]
generated: { by: connector:tiktok-public-video-embed, at: 2026-08-27T12:59:43Z }
verified:
  - { by: probe:tiktok-public-video-embed-live-20260827, at: 2026-08-27T12:59:43Z }
status: stable
stale_after: 2026-09-03T12:59:43Z
sources:
  - id: official-embed-videos
    resource: https://developers.tiktok.com/docs/en/embed-videos
    title: Embed Videos
    author: organization:tiktok
  - id: live-report
    resource: ../verifications/tiktok/public-video-embed/report.json
    title: Public video oEmbed live verification report
    author: probe:tiktok-public-video-embed-live
---

# TikTok

当前 catalog 对 TikTok 只作能力级声明：无需账号、API key、OAuth 或 Cookie，按一个明确的 canonical public video URL 调用官方 `GET /oembed`，读取最小公开视频描述。

Connector 只保留 VideoID、canonical URL、标题和缩略图尺寸；作者身份、原始 HTML、缩略图 URL、互动指标、评论、媒体内容和 raw payload 均被丢弃。该接口能否返回结果跟随平台上的公开视频可用性，不代表内容授权、长期存在或地区可播放。

未验证范围：关键词发现、Hashtag 搜索、批量采集、作者或互动数据、评论、媒体下载、Research API、自有账号 Display API、Content Posting API、草稿和发布。Research API 当前明确不面向 commercial users；Display API 只处理已授权用户自己的公开内容；发布是另一条有 app review、scope 和用户授权的写路线。

- [读取公开视频嵌入描述](../capabilities/tiktok/read-public-video-embed.md)

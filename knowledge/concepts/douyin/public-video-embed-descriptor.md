---
type: Concept
title: 抖音公开视频嵌入描述
description: 由明确 VideoID 标识、用于安全呈现公开抖音视频的最小标题、画面尺寸与官方播放器 URL 投影。
tags: [douyin, public-video, embed, player, metadata]
generated: { by: connector:douyin-public-video-embed, at: 2026-08-26T20:56:39Z }
verified:
  - { by: probe:douyin-public-video-embed-live-20260826, at: 2026-08-26T20:56:39Z }
status: stable
stale_after: 2026-09-02T20:56:39Z
sources:
  - id: platform
    resource: ../../platforms/douyin.md
    title: 抖音
    author: organization:douyin
  - id: official-iframe-api
    resource: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/iframe-player/get-iframe-by-video
    title: 通过 VideoID 获取 IFrame 代码
    author: organization:douyin
  - id: live-snapshot
    resource: ../../verifications/douyin/public-video-embed/snapshot.json
    title: Normalized live observation
    author: connector:douyin-public-video-embed
---

# 抖音公开视频嵌入描述

该概念表示一个明确 VideoID 对应的最小公开视频呈现信息：公开标题、视频画面宽高，以及固定在 `https://open.douyin.com/player/video` 的官方播放器 URL。

上游接口返回可直接注入页面的 iframe HTML；Connector 不把这段 HTML 暴露为知识，而是验证其中只有一个 `src`、host/path/VideoID 与参数均符合契约，再重建 `autoplay=0` 的播放器 URL。消费者自行决定是否以及如何在受信任 UI 中嵌入。

它不是完整视频元数据：不包含作者身份、头像、账号关系、互动指标、评论、媒体直链、封面、原始响应或平台日志。标题和可公开状态仍可能变化或消失，Collector 用固定公开视频样本持续探测并只提出审阅建议。

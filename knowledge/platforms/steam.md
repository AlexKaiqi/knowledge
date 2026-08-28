---
type: Platform
title: Steam
description: 当前准入公开评论 cursor page、partial 反馈观察投影，以及平台专属商店图像 review revision 准备。
tags: [steam, games, distribution, public-reviews, player-feedback, store-assets]
generated: { by: connector:steam-public-game-reviews, at: 2026-08-27T01:02:20Z }
verified:
  - { by: probe:steam-public-game-reviews-live-20260827, at: 2026-08-27T01:02:20Z }
status: stable
stale_after: 2026-09-03T01:02:20Z
sources:
  - id: official-review-api
    resource: https://partner.steamgames.com/doc/store/getreviews
    title: User Reviews - Get List
    author: organization:valve
  - id: official-review-semantics
    resource: https://partner.steamgames.com/doc/store/reviews
    title: User Reviews
    author: organization:valve
  - id: live-report
    resource: ../verifications/steam/public-game-reviews/report.json
    title: Steam public game reviews live verification
    author: probe:steam-public-game-reviews-live
---

# Steam

当前 catalog 准入三项没有平台写副作用的组合能力：无需账号读取一个明确 App ID 的有界公开评论页；再在本地把该页投影为可对账的去正文、去作者身份反馈观察窗口；以及按 Steam 当前规则准备待人工视觉审阅的商店图像 revision。

Steamworks 将评论描述为玩家表达产品是否符合预期的反馈渠道，并公开了 `store.steampowered.com/appreviews/<appid>` JSON 端点。Connector 固定使用该 origin/path，不接受任意 URL，不自动重试，也不把商店页面抓取或 Partner 权限混入这项能力。

输出删除 SteamID、昵称、头像、主页、拥有游戏数、评论数、最近游玩和跨评论作者关联，只保留推荐 ID、评论内容、创建/更新时间、推荐方向、评论时游玩时长和购买/赠送/Early Access/Steam Deck 情境。评论正文只允许瞬时结果使用；Git 验证快照只保存长度与 SHA-256。Steam 明确要求将用户评论用于营销材料前取得作者许可，因此这项能力不能提供营销引用授权。

未验证：Steam Partner 身份、自有游戏审核/发布状态、商店流量与愿望单报告、开发者回复、评论 flag/moderation、全量历史或 exactly-once 增量。`updated` cursor page 支持有界遍历，但页面之间可能因新评论、编辑、删除、语言和平台过滤发生重排；`corpusComplete` 固定为 `false`。

商店图像准备器只处理本地 PNG/JPEG 的机器可验证部分：Header `920×430`、Small `462×174`、Main `1232×706`、Vertical `748×896`，以及至少五张不低于 `1920×1080` 的 16:9 截图。logo 可读性、额外文字、PG-13、gameplay-only、权利和首发内容一致性始终 pending 人审；它不登录 Partner 后台，也不上传或送审。

观察窗口因此固定为 `partial`。resume cursor 只用于继续同一查询，不是全局 high-watermark；公开端点未证明 tombstone 与回复状态，所以页面缺失不能推断删除，checkpoint 也只保持不推进。语义摘要允许后续对账识别同一 recommendation ID 的编辑，但不恢复评论正文。

- [读取公开游戏评论页](../capabilities/steam/read-public-game-review-page.md)
- [Steam 公开游戏评论页概念](../concepts/steam/public-game-review-page.md)
- [将评论页投影为反馈观察窗口](../capabilities/steam/project-review-page-to-observation-window.md)
- [Steam Review Observation Window](../concepts/steam/review-observation-window.md)
- [准备 Steam 商店图像审阅 Revision](../capabilities/steam/prepare-store-asset-review-revision.md)
- [Steam Store Asset Review Revision](../concepts/steam/store-asset-review-revision.md)

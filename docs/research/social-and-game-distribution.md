# 社交传播与游戏分发候选调研

状态：candidate research；不是 canonical knowledge  
核验日期：2026-08-27

## 1. 结论

候选图谱此前漏掉了两个直接服务产品闭环的结果域：

1. **社交传播闭环**：发现话题/需求 → 发布内容 → 回收评论/提及 → 观察影响力。
2. **游戏分发闭环**：提交 build/store page → 审核/发布 → 回收玩家评论与商店流量 → 迭代产品。

因此微博、B 站和 X 不再只是模糊 Watch；LinkedIn 应在 B2B 渠道成立时进入高价值候选；Facebook 只考虑可授权的 Page。游戏渠道应至少区分 Steam、TapTap、itch.io、Epic，以及有条件的主机商店，而不是塞进“其他分发平台”。

这仍然不是“把所有平台接一遍”。每个平台只在具体内容形态、目标受众、自有身份和未来发布计划成立时激活，而且公开研究、自有账号读写、评论反馈必须是不同 Capability。

## 2. 社交平台候选

| 平台 | 可验证的官方能力面 | 高价值切片 | 关键边界 | 建议 |
| --- | --- | --- | --- | --- |
| 微博 | 开放平台与官方 `weibo-cli` 覆盖 OAuth、内容搜索、发布、互动管理和统计 | 关键词/话题需求快照；自有微博发布 receipt；评论/提及与指标增量 | 套餐和 endpoint 额度可能影响可用性；CLI 存在不等于当前账号有权限 | **P1，高优先调研**；先审计 CLI 版本/许可/返回 Schema，再做只读搜索或本人账号状态 probe |
| B 站 | 开放平台提供授权、视频/专栏发布删除查询、授权稿件数据、沙盒和 webhook | 自有视频/专栏发布与状态；稿件评论/指标增量；公开研究另立能力 | 创建应用需身份认证；仅操作授权 UP 主；开发者协议限制数据用途、留存和转移 | **P1，高优先调研**；先用沙盒或只读授权数据，不把公开搜索和账号发布混为一体 |
| X | 官方 API 提供 recent/full-archive search、发帖、mentions、webhook 和公有/自有指标 | 话题与提及增量；自有 post/reply receipt；内容影响力 | 当前按量计费，读量和 endpoint 成本需预算门；公开研究与自有账号 scope 分离 | **P1**；先做固定 query、小预算、有限时间窗的只读 probe |
| LinkedIn | Community Management API 可管理公司/成员内容、评论/反应和统计 | B2B 内容发布；公司页/成员反馈；post/organization Analytics | vetted access；公司与成员权限不同；API 版本更新频繁 | **P1 条件式**；只有 B2B 受众明确时激活 |
| Facebook | Meta 官方 Graph API workspace 持续维护相关接口 | 自有 Page 发布、评论/提及和 Page Insights | 只考虑 Page；不把个人主页或未授权 Group 当自动化目标；需 app review/权限 live audit | **P1 条件式**；与 Instagram 共用 Meta app 基础设施，但保持独立权限和 Schema |
| Twitch | API、OAuth 和 EventSub 覆盖直播状态、互动、视频/Clip、频道/游戏 Analytics | 游戏直播传播、观众互动和影响力变化 | 不是游戏分发商店；必须绑定授权 broadcaster，聊天数据有成员隐私边界 | **P1 条件式**；在有直播运营计划时激活 |

抖音、YouTube、微信公众号、TikTok、Instagram 和快手继续留在 P1；它们与本表共同组成“内容传播候选组合”，不按平台名一次性接入。

## 3. 游戏分发平台候选

| 平台 | 官方事实 | 高价值切片 | 关键边界 | 建议 |
| --- | --- | --- | --- | --- |
| Steam | Steamworks 要求 store/build review；批准后仍需有权限的人点击 Release App/Publish Now/Release Now；公开评论有正式分页 API；Partner 有流量与 UTM 转化报告 | 公开游戏/评论需求快照；自有审核/发布状态；商店曝光、访问、愿望单/转化；release handoff | 正式发布必须保留人工确认；评论返回 SteamID 等作者信息，Connector 必须删除；Partner 报告需要 app 权限 | **P1，首要游戏候选**；先做无需 Partner 的公开评论增量，再准备自有 app 只读状态 |
| TapTap | 开发者中心覆盖移动/PC 游戏创建、预约、测试、审核、立即/定时发布、版本更新和经营数据 | 中国游戏发现/评论信号；自有游戏上架与版本状态；发布后数据 | 平台协议把评论、评分、帖子、点击/下载等列为用户或平台运营数据；没有授权不能把可见内容当开放 API | **P1，中国游戏优先**；自有发布与公共研究两条路线分别做条款和 probe |
| itch.io | 官方 butler CLI 支持 CI 和 channel build 上传，上传完成后新 build 可立即 live；Creator dashboard 有发现/下载/游玩 Analytics | 不可变 build 发布 receipt；channel 版本；分发影响力 | 写操作立即生效；只有真实独立游戏发布目标时有价值 | **P1 条件式**；用私密/受控测试页验证，并在 Connector 外保留最终确认 |
| Epic Games Store | 官方自助发布面支持 PC 产品分发 | 提交、审核、release-state 与商店运营 | 组织/协议/费用门槛；多人游戏 crossplay、成就等要求；没有公开目标游戏时维护成本高 | **P1 条件式**；明确 PC 商店策略后激活 |
| Xbox / PlayStation / Nintendo eShop | 均有官方 Partner/Developer 准入与自助发布流程；Nintendo 明确允许获批开发者自行定价和发布日期 | 主机 build/认证/提交/release-state | gated 身份、硬件和认证；平台差异很大 | **P2**；有真实主机项目和获批身份后逐个建立，不抽象“统一主机 Connector” |
| GOG / Game Jolt 等 | 有特定玩家群与分发价值 | 发布、评论和渠道效果 | 受众、准入与维护价值尚未证明 | **P2/Watch**；由实际发行计划触发，不为完整名单预建 |

## 4. 推荐 probe 顺序

在不改变当前“小红书 active build、闲鱼和 App Store active research”在制品限制的前提下，后续研究按以下顺序领取槽位：

1. **微博官方 CLI 只读面**：确认当前版本、许可、套餐、OAuth scope、关键词搜索和本人账号状态的真实返回。
2. **B 站官方沙盒/授权只读面**：确认应用准入、视频/专栏状态和稿件指标字段；暂不发布。
3. **Steam 公开评论增量**：固定 appID、recent/updated cursor、20 条上限，删除作者 SteamID，验证 checkpoint 与更新语义。
4. **TapTap 路线审计**：先区分自有游戏开发者能力与公开社区研究，未完成条款判断前不抓评论。
5. **X 小预算搜索**：固定 query、时间窗、最大读量和费用上限；必须能预估与停止成本。
6. **Facebook Pages / LinkedIn**：由消费型还是 B2B 受众决定先后，并以实际 app access/账号为准。

Steam 的最小 probe 通过标准建议为：从官方评论端点读取固定游戏自 checkpoint 以来的最近/更新评论，稳定保留 recommendation ID、时间、语言、推荐与否、游玩阶段和正文主题，删除 SteamID、拥有游戏数等作者画像，并正确处理空页、游标和评论更新。它只证明“公开玩家反馈切片”，不证明 Steam 发布闭环。

## 5. Connector 与 Collector 边界

Connector 隐藏各平台 OAuth、分页、webhook、计费、原生状态、上传工具和失败重试，只向 OKF 暴露结果能力。公开搜索、本人账号读取和平台写入不得因为共享一个 SDK 就合并授权。

Collector 只持续观察：

- 官方 API 版本、权限、审核、套餐/费用和数据政策；
- Connector 所依赖 CLI/SDK 的 release、HEAD、许可证、归档和高信号 issue；
- 上一次 live/sandbox verification 的新鲜度和失败分类；
- 当前 active candidate 是否出现更低权限、更稳定的官方路线。

Collector 不自动安装 CLI、不注册开发者账号、不接受协议、不登录、不购买套餐、不执行发布，也不建立用于绕过平台风控的身份池。

## 6. 官方证据

- 微博开放平台与官方 CLI：<https://weibo.com/openapi>、<https://open.weibo.com/cli/index>
- 哔哩哔哩开放平台、隐私政策与开发者协议：<https://openhome.bilibili.com/doc>、<https://openhome.bilibili.com/agreement/privacy-policy>、<https://openhome.bilibili.com/agreement/developer-service>
- X 搜索、指标、webhook 与定价：<https://docs.x.com/x-api/posts/search/introduction>、<https://docs.x.com/x-api/fundamentals/metrics>、<https://docs.x.com/x-api/webhooks/introduction>、<https://docs.x.com/x-api/getting-started/pricing>
- LinkedIn Community Management 与 post statistics：<https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview>、<https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics>
- Meta 官方 Facebook Graph API workspace：<https://www.postman.com/meta/facebook/overview>
- Twitch API 与 EventSub：<https://dev.twitch.tv/docs/api/>、<https://dev.twitch.tv/docs/eventsub/>
- Steam 发布、评论与流量：<https://partner.steamgames.com/doc/store/releasing?language=english>、<https://partner.steamgames.com/doc/store/getreviews>、<https://partner.steamgames.com/doc/marketing/traffic_reporting>
- TapTap 游戏创建、开发者协议：<https://developer.taptap.cn/docs/store/release/publish/create-game/>、<https://developer.taptap.cn/docs/agreement/>
- itch.io butler 与平台 Analytics：<https://itch.io/docs/butler/pushing.html>、<https://itch.io/docs/general/about>
- Epic Games Store 分发：<https://store.epicgames.com/distribution/>
- Xbox、PlayStation、Nintendo 开发者入口：<https://developer.microsoft.com/en-US/games/partner/>、<https://partners.playstation.net/>、<https://developer.nintendo.com/>

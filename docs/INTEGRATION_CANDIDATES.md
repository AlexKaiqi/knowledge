# 有价值的候选接入对象

状态：候选组合，不是 canonical knowledge  
复审日期：2026-08-27

## 结论

候选单位不是“一个平台”，而是一条能单独验证的结果切片：

```text
明确输入
→ 合法、可维护的访问路线
→ 一个真实动作或观测
→ 平台侧 receipt / checkpoint
→ 对产品决策有用的稳定输出
```

例如，“接入 Google Play”过大；“读取自有 App 自 checkpoint 以来的新评论并去除评论者身份”才是候选。公开研究、私有反馈和平台写入必须拆开，分别验证、授权和维护。

候选不会进入 `knowledge/`，也不会因为有官方文档、能返回 HTTP 200 或有开源实现就算可用。只有完成 live/sandbox probe 的单个切片，才按准入流程建立最小 Subject、Capability、Schema、Connector 与 Verification。

## 排序规则

候选必须先通过五个硬门：

1. **结果**：直接推进需求发现、产品研究、内容/App 发布、分发、反馈或影响力测量。
2. **缺口**：没有这项接入时，现有模型和工具不能稳定完成对应任务。
3. **合法路线**：至少存在一条可授权、可说明使用边界的路线；逆向或浏览器路线不能冒充官方 API。
4. **可验证**：能定义一个有界的 live/sandbox probe、断言、checkpoint、失败语义和必要清理。
5. **可维护**：官方规则、上游实现和行为 probe 能被 Collector 持续观察，且维护成本与价值相称。

通过硬门后只做粗粒度排序，不用虚假的精确分数：

- **P0**：能补齐当前最重要闭环，已有可行路线，下一步就是准备 probe。
- **P1**：价值高，但依赖账号、应用审核、目标市场或先完成 P0 的公共 Schema。
- **P2**：在特定产品或渠道策略成立时有价值，不常驻实施队列。
- **Watch**：需求真实，但当前没有足够稳定或合规的路线；只观察官方变化。
- **Reject**：与目标闭环无直接关系，或现有工具已经足够。

实施在制品限制为：**一个 active build、最多两个 active research**。没有可用 identity、实际发布目标或可执行 probe 的条目不得长期占用 active 队列。

## 当前基线：有原语，不等于有平台闭环

| 对象 | 已验证的真实范围 | 仍缺少的结果 |
| --- | --- | --- |
| 小红书 | 官方账号接口面、社区规则、本人笔记列表 | 私密发布 receipt、持续反馈、指标和失败对账；平台完整闭环仍为 0 |
| 抖音 | 官方开放平台文档面、指定公开视频的嵌入描述 | 自有账号发布、回执、评论、指标和需求发现；平台完整闭环仍为 0 |
| GitHub | 搜索、文件、tag、release、issue/PR 增量原语 | 已足够作为隐藏 Collector 底座；不再扩成通用公共知识 |
| Hugging Face | 精确模型 revision 文件清单 | 只在前沿模型、数据集和评测发现有具体需求时增加隐藏 Collector；不做模型仓库百科 |

## P0：下一批可执行候选

P0 按下面顺序一次只推进一个。前一项没有真实 probe 结论，不并行铺设新的 canonical Subject。

| 顺序 | 候选结果切片 | 直接价值 | 首选访问路线 | 最小 probe 与通过标准 | 当前门槛 |
| --- | --- | --- | --- | --- | --- |
| 1 | **小红书私密发布并对账初次观测** | 把已有读取原语补成第一个最小内容发布闭环 | 已固定的浏览器辅助候选路线；官方创作平台作为人工 recovery | 对冻结 revision 一次确认后仅自己可见发布；必须从本人主页重发现、详情核对、取得稳定 note ID/URL 并读取去身份化初次反馈 | 平台写入；需要用户明确批准、受控自有账号、可见浏览器和未知结果禁重发 |
| 2 | **小红书自有笔记反馈与指标增量** | 持续观察发布后的传播和需求信号 | 本人主页/创作服务平台的只读浏览器路线；多 route 只做对账不盲目 fallback | 对已知 note ID 从 checkpoint 读取指标和新评论；验证去身份化、编辑/删除语义和空窗口 | 需先证明详情/评论路线的新鲜度；不得采集跨笔记身份图谱 |
| 3 | **闲鱼公开商品市场信号快照** | 从真实出售语境发现价格带、出售原因、故障、兼容性、配件和替代需求 | 官方 Web 可见浏览器、小样本只读路线；两个 Apache-2.0 浏览器项目只作为待审计原语 | 一个产品关键词、首屏/最多 20 项、不翻页；返回明确不完整的去身份化信号，并重新打开一个样本核对 | 官方协议确认匿名浏览/搜索基础服务，但没有公共市场研究 API；自动化、个性化、登录和数据保留边界仍需 live probe 与条款审阅 |
| 4 | **App Store 公开应用检索与对比快照** | 竞品发现、版本/定价/评分变化、市场调研 | Apple 公开 Search/Lookup API；按国家和 software entity 固定查询 | 无账号 live 查询一个固定应用和一个固定关键词；验证 ID、版本、价格、评分、结果边界和 checkpoint 可复现 | 官方文档已归档，必须先验证当前端点、限流和字段漂移；不能承诺榜单或全量搜索 |
| 5 | **App Store Connect 自有 App 评论增量** | 直接收集需求和版本反馈 | App Store Connect API `customerReviews`；JWT 只读 key | 使用自有测试/生产 App 从 checkpoint 读取评论或合法空集；按 territory/rating/version 归一化，输出不含作者身份 | 需要最小权限 API key、opaque credential ref 和一个归属明确的 App |
| 6 | **Google Play 自有 App 评论增量** | 直接收集需求、设备/版本问题和回复状态 | Android Publisher Reviews API；月度历史回填可另用受控 GCS report | 使用自有 App 读取增量或合法空集；保留版本、设备类别、语言、星级、正文和回复状态，删除作者身份 | 需要 Play Console 权限与受控 probe App；API 增量和月报回填必须是两个内部 route、一个稳定输出 |
| 7 | **App Store Connect / Google Play 自有发布状态读取** | 统一判断 build、审核、track、分阶段发布是否真实生效 | 两个平台各自官方 API，公共输出使用同一 `OwnedAppReleaseState` 概念但不强行统一原始字段 | 各用一个自有 App 只读查询当前版本、build、审核/track 状态和更新时间；保存平台原生状态及规范化大类 | 必须分成两个 Connector 和两个 probe；先读后写，不把平台差异抹掉 |

说明：顺序 1 不是最容易的 API，而是当前最接近第一个完整平台闭环、且已经投入实现的切片。它有真实平台写入，所以不能为了赶进度绕过一次性确认。闲鱼公开市场信号和 App Store 公开检索占用两个 active research 槽位，但在小红书 probe 完成前不抢占 active build；App Store Connect 和 Google Play 私有切片还需要用户提供自有开发者身份。

## P1：P0 之后按实际渠道激活

| 候选对象 | 值得接入的切片 | 为什么不是当前 P0 |
| --- | --- | --- |
| App Store Connect | TestFlight 提交、处理状态、测试反馈与发布 receipt | App 不能通过 App Store Connect API 创建，build 上传还需 Xcode/Transporter；应先完成只读发布状态和受控测试 App |
| Google Play | Internal testing track 上传、提交、状态对账；生产发布另立能力 | 官方 Edits/Bundle/Track 路线清晰，但写操作要有受控测试 App、不可变 revision、显式确认和防重复提交 |
| 抖音 | 自有内容发布、平台 receipt、评论/指标增量 | 比继续维护文档面更有价值，但需要开放平台应用、scope、授权账号和对应审核；现有两个能力不能证明可调用 |
| YouTube | 公开视频/频道/评论研究；自有频道上传、评论管理和 Analytics | 官方 Data/Analytics API 能覆盖研究、发布、反馈和影响力，但需要先确定海外视频渠道是实际目标并准备 OAuth/channel identity |
| 微信公众号 | 自有账号草稿、发布结果、评论/阅读数据 | 对中文图文传播价值高；先核实账号类型、接口权限、IP 白名单和新版 API 的真实可用范围，再建立候选 Connector |
| TikTok | 自有账号视频/图片 Direct Post 或草稿上传、状态 webhook、本人视频指标 | 官方 Content Posting API 可用，但需要 app review、`video.publish` scope 和用户授权；未审计客户端只能私密发布 |
| Instagram | Professional 账号内容发布、评论和 Insights | 官方路线只面向 Business/Creator 等专业账号，依赖 Meta app、权限和可能的 app review |
| 快手 | 自有账号视频发布、发布状态和数据回读 | 官方开放平台存在视频发布接口；仍需核实申请范围、数据/评论接口和 probe identity 后再排期 |
| Hugging Face | 前沿模型、数据集、评测集的新发布/趋势候选 Collector | 只作为研究发现底座；精确 revision 原语已经存在，不新增公共百科能力 |

P1 不是“全部都接”。某个平台只有在存在实际账号、内容形态、目标受众和未来 30 天发布计划时，才提升为 active research。

## P2：有条件的需求与传播来源

| 对象 | 可产生的信号 | 激活条件 |
| --- | --- | --- |
| Product Hunt | 新产品、launch 反馈、评论与主题趋势 | 产品确实面向 Product Hunt 受众；先解决 API 非商业使用限制，不能假设 API 支持代替人工 launch |
| Hacker News | 技术产品讨论、Show HN 反馈和链接传播 | 产品面向开发者；官方 Firebase API 只提供 item/user/update，不把第三方搜索能力冒充官方能力 |
| Reddit | subreddit 需求、评论主题和发布反馈 | 有明确社区与合规 OAuth 用途，重新核验 Data API 访问政策、限额和保留规则后才启用 |
| LinkedIn | 公司页/成员内容发布、评论、反应和分析 | B2B 渠道成立且 Community Management API vetted access 获批；版本迁移成本可接受 |
| Discord / Slack 自有社区 | 已授权社区内的需求、支持问题和反馈闭环 | 用户拥有或管理相应 workspace/server，并明确频道、保留期和成员隐私边界 |
| 国内其他安卓商店 | 上架状态、评论、下载与渠道效果 | 小米、OPPO、vivo、应用宝成为明确发布目标时逐个研究；不为“覆盖完整”预建空 Connector |

## Watch：只观察，不做实现承诺

- **Google Play 公开竞品搜索/详情/评论**：公开商店页面有价值，但本轮未发现面向第三方竞品检索和评论的正式 Google Play Developer API。继续观察官方能力；浏览器或第三方数据路线必须单独审查条款、地域/设备个性化和可重复性。
- **B 站、知乎、微博**：传播价值可能很高，但先找到当前官方、可申请、可验证的发布/反馈范围。没有稳定路线前不以非官方脚本数量替代可用性。
- **小红书、抖音的公开搜索与大规模评论采集**：需求真实，但涉及登录、反自动化、身份与数据最小化。只研究有界、小样本、明确用途的路线，不维护身份池规避风控。
- **TikTok Research API**：公开内容研究能力强，但有研究资格和用途限制；商业需求研究不能默认借用学术研究权限。
- **X / Twitter**：接入价值取决于实际受众；API 套餐、权限和政策波动在建立任何候选前重新核实。

## Reject：明确不再进入候选池

- npm、PyPI、Maven Central、NuGet、Go Modules、crates.io 等包管理器。
- Docker Hub 等镜像/制品仓库。
- OSV 等与本产品闭环无直接关系的通用漏洞元数据源。
- 仅因“有 RSS/API、容易 live probe”而接入的普通技术信息源。
- GitHub 的通用文件、tag、release 操作扩展为公共百科；这些只作为隐藏 Collector 原语消费。
- 模型已经能可靠完成、且没有账号、安全、稳定性或对账复杂度需要隔离的普通工具操作。

## 最小公共 Schema 族

平台字段不统一，不应先设计一个万能 Schema。只共享跨平台真正稳定的结果概念，并保留平台原生状态：

| Schema 概念 | 最小稳定字段 | 不应强行统一的字段 |
| --- | --- | --- |
| `PublicMarketSignalSnapshot` | platform、query、filters、observedAt、sampleCount、sampleComplete、price observations、deidentified themes、evidence refs | 排名算法、供需总量、成交事实、卖家画像、跨查询用户关联 |
| `PublicAppListingSnapshot` | platform、app ID、territory、observedAt、title、version、price、rating、source URL | 榜单算法、分类体系、兼容设备、平台推荐理由 |
| `OwnedAppReviewDelta` | platform、app ID、checkpoint、observedAt、rating、text、locale、app version、reply state | 评论者身份、设备精确标识、平台翻译/摘要内部字段 |
| `OwnedAppReleaseState` | platform、app ID、observedAt、native state、normalized phase、build/version、lastTransitionAt | Apple 审核状态与 Google track/edit 的一一映射 |
| `PublicationReceipt` | platform、operation/revision ID、submittedAt、confirmedAt、platform content ID、stable URL、checks | 各平台上传协议、临时 token、内部 route 和原始 response |
| `FeedbackDelta` | platform、content/app ID、checkpoint、observedAt、feedback entries、aggregate counts | 用户身份图谱、跨平台用户合并、无限期原文保留 |
| `InfluenceSnapshot` | platform、content/account ID、observedAt、平台原生指标和少量规范化指标 | 对不同平台曝光、播放、阅读和互动含义做虚假等价 |

每个平台仍拥有自己的输入/输出 Schema；公共概念只是外界可理解的稳定投影。Connector 负责翻译和隔离差异，Collector 负责发现字段/规则漂移并提出 proposal。

## Collector 只维护四类事实

1. 官方文档、政策、权限、审核和版本变化。
2. Connector route 的 upstream HEAD/tag、许可证、归档、issue 与 conformance 变化。
3. 上一次 live/sandbox verification 的新鲜度和失败分类。
4. 与当前 active candidate 直接相关的新路线或故障证据。

Collector 不积累“某平台所有 API”，不自动安装第三方项目、不申请权限、不登录、不执行平台写操作，也不把候选提升为 OKF。

## 本轮官方证据

以下来源只证明候选边界，不证明本仓库已接入：

- Apple App Store Connect API：<https://developer.apple.com/documentation/appstoreconnectapi/>
- Apple Customer Reviews：<https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews>
- Apple Analytics Reports：<https://developer.apple.com/documentation/AppStoreConnectAPI/downloading-analytics-reports>
- Apple 公开 Search API（归档文档）：<https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html>
- Google Play Developer API：<https://developers.google.com/android-publisher/api-ref/rest>
- Google Play Reviews：<https://developers.google.com/android-publisher/api-ref/rest/v3/reviews>
- Google Play 月度报告与 Reviews CSV：<https://support.google.com/googleplay/android-developer/answer/6135870>
- Google Play Developer Reporting API：<https://developers.google.com/play/developer/reporting>
- YouTube Data API：<https://developers.google.com/youtube/v3/docs>
- YouTube Analytics API：<https://developers.google.com/youtube/analytics>
- TikTok Content Posting API：<https://developers.tiktok.com/products/content-posting-api>
- TikTok Direct Post 边界：<https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post>
- Instagram API 官方 Postman 文档：<https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api>
- LinkedIn Community Management API：<https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview>
- Product Hunt API v2：<https://www.producthunt.com/v2/docs>
- Hacker News 官方 API：<https://github.com/HackerNews/API>
- Reddit Data API Terms：<https://redditinc.com/policies/data-api-terms>
- 闲鱼社区用户服务协议：<https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html>
- 淘宝开放平台闲鱼电商 SaaS API 目录：<https://developer.alibaba.com/docs/api.htm?apiId=73221&source=search>
- 快手视频发布接口：<https://open.kuaishou.com/platform/openApi?menu=20>

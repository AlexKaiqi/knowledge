# 有价值的候选接入对象

状态：候选组合，不是 canonical knowledge  
复审日期：2026-08-27

## 结论

候选单位不是“一个平台”，而是某个产品目标下能单独验证的工作流或难点切片：

```text
Goal
→ User Workflow
→ evidenced Difficulty
→ independently testable Opportunity
→ 合法、可维护的 source/capability route
→ Probe / receipt / checkpoint
```

例如，“接入 Google Play”过大；“读取自有 App 自 checkpoint 以来的新评论并去除评论者身份”才是候选。公开研究、私有反馈和平台写入必须拆开，分别验证、授权和维护。

候选不会进入 `knowledge/`，也不会因为有官方文档、能返回 HTTP 200 或有开源实现就算可用。平台表只回答“目标需要时有哪些路线”；它不自行决定建设顺序。只有某个 Goal 需要、证据支持且完成 live/sandbox probe 的单个切片，才按准入流程建立最小 Subject、Capability、Schema、Connector 与 Verification。

当前首个目标研究任务是[个人助理/宠物](research/personal-assistant-pet-goal.md)。GitHub 用于发现真实实现摩擦、bug、workaround 和可运行项目；arXiv 用于发现经过定义的能力缺口、benchmark 和方法。两类证据必须交叉解释，不能用 star/citation 数量替代问题价值。

## 排序规则

候选必须先通过五个硬门：

1. **结果**：直接推进需求发现、产品/前沿研究、内容/App/研究成果发布、分发、反馈或影响力测量。
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

说明：顺序 1 不是最容易的 API，而是当前最接近第一个完整平台闭环、且已经投入实现的切片。它有真实平台写入，所以不能为了赶进度绕过一次性确认。个人助理/宠物目标研究和闲鱼公开市场信号占用两个 active research 槽位，但在小红书 probe 完成前不抢占 active build；App Store 公开检索退回队列，等待目标研究生成具体竞品/query 后激活。App Store Connect 和 Google Play 私有切片还需要用户提供自有开发者身份。

## P1：P0 之后按实际渠道激活

### P1A：社交与内容传播

| 候选对象 | 值得接入的切片 | 为什么不是当前 P0 |
| --- | --- | --- |
| 抖音 | 自有内容发布、平台 receipt、评论/指标增量 | 比继续维护文档面更有价值，但需要开放平台应用、scope、授权账号和对应审核；现有两个能力不能证明可调用 |
| YouTube | 公开视频/频道/评论研究；自有频道上传、评论管理和 Analytics | 官方 Data/Analytics API 能覆盖研究、发布、反馈和影响力，但需要先确定海外视频渠道是实际目标并准备 OAuth/channel identity |
| 微信公众号 | 自有账号草稿、发布结果、评论/阅读数据 | 对中文图文传播价值高；先核实账号类型、接口权限、IP 白名单和新版 API 的真实可用范围，再建立候选 Connector |
| 微博 | 关键词/话题需求研究；自有账号发布、互动管理和影响力统计 | 官方开放平台与 `weibo-cli` 已覆盖搜索、发布、互动和统计，但套餐、额度、OAuth identity 和 CLI 实际返回语义仍需独立 probe；不能因官方 CLI 存在就算已接入 |
| B 站 | 自有视频/专栏发布、状态、评论和稿件指标；公开内容研究另立切片 | 官方开放平台有账号授权、视频/专栏管理、数据开放、沙盒和 webhook；需要实名认证应用、授权 UP 主和数据用途/保留约束，公开搜索不能混入自有账号能力 |
| TikTok | 自有账号视频/图片 Direct Post 或草稿上传、状态 webhook、本人视频指标 | 官方 Content Posting API 可用，但需要 app review、`video.publish` scope 和用户授权；未审计客户端只能私密发布 |
| Instagram | Professional 账号内容发布、评论和 Insights | 官方路线只面向 Business/Creator 等专业账号，依赖 Meta app、权限和可能的 app review |
| Facebook Pages | 自有 Page 内容发布、评论/提及回收和 Page Insights | 只考虑 Page，不考虑个人主页或未授权 Group；Graph API 路线需要 Meta app、Page token、权限和 app review，先做权限面与版本 live audit |
| X | 关键词/话题/提及研究；自有账号发帖、回复和指标增量 | 官方 API 有 recent/full-archive search、发帖、mentions、webhook 和指标，但当前按量计费、读量上限和 endpoint 价格必须由 Connector 做预算门；公开研究与自有账号运营分开验证 |
| LinkedIn | 公司页或成员内容发布、评论/反应和分析 | B2B 渠道成立时价值高；Community Management API 需要 vetted access，且公司页与成员权限、统计 Schema 和版本迁移必须拆开 |
| 快手 | 自有账号视频发布、发布状态和数据回读 | 官方开放平台存在视频发布接口；仍需核实申请范围、数据/评论接口和 probe identity 后再排期 |

### P1B：游戏分发、玩家反馈与传播

| 候选对象 | 值得接入的切片 | 为什么不是当前 P0 |
| --- | --- | --- |
| Steam | 固定游戏的公开评论增量；自有游戏审核/发布状态、商店流量、愿望单和 release handoff | 官方评论 API 与 Steamworks 报告价值很高；自有发布依赖 Partner/appID/权限，正式 release 是不可逆高影响人工确认，公开评论还必须删除 SteamID 等作者字段 |
| TapTap | 中国移动/PC 游戏发现和玩家反馈；自有游戏预约、测试、上架、版本与数据回读 | 官方开发者中心覆盖创建、审核、定时/立即发布和经营数据，但评论、评分、帖子等属于平台/用户数据，公共研究路线必须先做条款与数据授权审阅 |
| itch.io | 独立游戏 build/channel 发布 receipt 与发现/下载/游玩 Analytics | 官方 butler CLI 可可靠上传且上传完成即可 live，适合小团队；只有实际选择 itch.io 分发时才准备自有测试页、不可变 build 和写入确认 |
| Epic Games Store | 自有 PC 游戏提交、审核和 release-state 对账 | 有自助发布工具，但需要组织账号、协议、每个产品的提交费用，并满足多人游戏 crossplay、成就等要求；只有明确 PC 商店策略时激活 |
| Twitch | 自有频道直播状态、观众互动、视频/Clip 和游戏/频道 Analytics | 它是游戏传播和反馈渠道，不是游戏商店；OAuth、EventSub 和授权 broadcaster 存在后才有闭环价值 |

### P1C：前沿研究发现与研究成果发布

| 候选对象 | 值得接入的切片 | 为什么不是当前 P0 |
| --- | --- | --- |
| arXiv | 按明确技术主题读取新论文/新版本增量；自有预印本提交前检查、状态观察和最终人工 handoff | 公开 Atom API、RSS/OAI 路线清晰，适合低频 Collector；但最终投稿要求注册作者自助提交、可能 endorsement、许可确认和 moderation，不能抽象成无人值守 `publish-paper` |
| OpenAlex | 跨 arXiv、期刊和会议的 work/topic/citation 增量与研究脉络 | 官方图谱 API 可搜索、过滤、聚合和语义检索，但它是派生索引，不替代论文原文、发布平台或同行评审事实；需要与 arXiv ID/DOI 做证据对账 |
| OpenReview | AI/ML 会议的公开投稿、评审、rebuttal、decision 变化；自有 venue-specific submission state | API 能读取 Notes/Reviews/Decisions，但提交由具体 venue 的 Invitation、字段、读者、截止时间和身份决定；不能建立一个跨会议通用写入 Schema |
| Semantic Scholar | 基于种子论文的相关工作推荐、citation/reference 增量和补充检索 | 官方 Academic Graph/Recommendations API 有价值，但与 OpenAlex 重叠且属于派生排序；只在它能提高召回或关联质量时作为第二 route，不单独建立学术百科 |
| Crossref / DataCite | DOI 元数据、license、资助、版本、修正/撤回和发布后对账 | 更适合作为隐藏 Collector 与证据解析底座；通常不是作者直接发布论文的入口，普通 DOI 查询也无需暴露成 OKF 能力 |
| Zenodo | 论文配套数据、代码、模型、报告或预印本的 sandbox deposit、文件上传、DOI 预留和最终发布 receipt | 官方 REST API 有独立 sandbox，但正式 publish 后记录不可删除；必须使用不可变 revision、元数据/license 预检和最终人工确认 |

研究发现的价值不在“搜索一篇论文”——模型和 Web 已能做一次性检索。值得维护的是：针对明确研究问题持续发现新作/新版本，跨 arXiv ID、DOI、OpenReview ID 去重，保留一手证据，并把“论文声称什么”和“我们的推断/重要性判断”分层。

### P1D：App 发布与研究底座

| 候选对象 | 值得接入的切片 | 为什么不是当前 P0 |
| --- | --- | --- |
| App Store Connect | TestFlight 提交、处理状态、测试反馈与发布 receipt | App 不能通过 App Store Connect API 创建，build 上传还需 Xcode/Transporter；应先完成只读发布状态和受控测试 App |
| Google Play | Internal testing track 上传、提交、状态对账；生产发布另立能力 | 官方 Edits/Bundle/Track 路线清晰，但写操作要有受控测试 App、不可变 revision、显式确认和防重复提交 |
| Hugging Face | 前沿模型、数据集、评测集的新发布/趋势候选 Collector | 只作为研究发现底座；精确 revision 原语已经存在，不新增公共百科能力 |

P1 不是“全部都接”。某个平台只有在存在实际账号、内容形态、目标受众和未来 30 天发布计划时，才提升为 active research。

## P2：有条件的需求与传播来源

| 对象 | 可产生的信号 | 激活条件 |
| --- | --- | --- |
| Product Hunt | 新产品、launch 反馈、评论与主题趋势 | 产品确实面向 Product Hunt 受众；先解决 API 非商业使用限制，不能假设 API 支持代替人工 launch |
| Hacker News | 技术产品讨论、Show HN 反馈和链接传播 | 产品面向开发者；官方 Firebase API 只提供 item/user/update，不把第三方搜索能力冒充官方能力 |
| Reddit | subreddit 需求、评论主题和发布反馈 | 有明确社区与合规 OAuth 用途，重新核验 Data API 访问政策、限额和保留规则后才启用 |
| Discord / Slack 自有社区 | 已授权社区内的需求、支持问题和反馈闭环 | 用户拥有或管理相应 workspace/server，并明确频道、保留期和成员隐私边界 |
| 国内其他安卓商店 | 上架状态、评论、下载与渠道效果 | 小米、OPPO、vivo、应用宝成为明确发布目标时逐个研究；不为“覆盖完整”预建空 Connector |
| Xbox / PlayStation / Nintendo eShop | 自有主机游戏准入、认证、提交和 release-state 对账 | 都是 gated partner 路线；只有存在目标游戏、硬件/认证计划和获批开发者身份时逐个平台建 Connector，不先做“主机商店统一层” |
| GOG / Game Jolt 等其他游戏商店 | 特定玩家群的发布和反馈 | 有明确受众、可验证自助/合作准入路线和未来发布计划后再研究，不为补齐平台名单占用维护预算 |
| PubMed / Europe PMC / bioRxiv / medRxiv | 生命科学与医学的新论文、预印本、版本和撤回信号 | 只有相关产品进入生命科学/医学领域时激活；医疗结论必须回到原始研究、指南与专业审查，不能把聚合摘要当建议 |
| SSRN 等领域预印本平台 | 社会科学、经济、法律等领域的新研究 | 目标研究领域明确且存在可维护的官方访问路线时再研究，不为覆盖学科建立空 Connector |

## Watch：只观察，不做实现承诺

- **Google Play 公开竞品搜索/详情/评论**：公开商店页面有价值，但本轮未发现面向第三方竞品检索和评论的正式 Google Play Developer API。继续观察官方能力；浏览器或第三方数据路线必须单独审查条款、地域/设备个性化和可重复性。
- **知乎**：传播与专业需求信号可能有价值，但当前还没有完成官方、可申请、可验证的发布/反馈范围审计。没有稳定路线前不以非官方脚本数量替代可用性。
- **小红书、抖音的公开搜索与大规模评论采集**：需求真实，但涉及登录、反自动化、身份与数据最小化。只研究有界、小样本、明确用途的路线，不维护身份池规避风控。
- **TikTok Research API**：公开内容研究能力强，但有研究资格和用途限制；商业需求研究不能默认借用学术研究权限。
- **Google Scholar、ResearchGate、Academia.edu**：检索/学术传播价值存在，但没有完成稳定、可申请、可验证的官方自动化路线审计。优先组合 arXiv/OpenAlex/OpenReview/Crossref 等正式接口，不维护网页抓取来追求“全库”。

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
| `ResearchWorkDelta` | source、source work ID、canonical identifiers、title、authors、published/updated/version、topics、abstract/evidence refs、checkpoint | 把派生推荐分数当事实、跨源作者强制合并、无证据的“突破性”判断、未经许可的全文副本 |
| `ResearchSubmissionState` | platform、owned submission ID、source revision/digest、metadata digest、native state、submitted/announced timestamps、record URL、license/DOI（若已有） | arXiv moderation、OpenReview venue workflow 与 Zenodo deposition 状态的一一映射；endorsement/审稿结果预测 |

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
- X API 搜索、指标与定价：<https://docs.x.com/x-api/posts/search/introduction>、<https://docs.x.com/x-api/fundamentals/metrics>、<https://docs.x.com/x-api/getting-started/pricing>
- LinkedIn Community Management 与成员内容统计：<https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview>、<https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics>
- Meta 官方 Facebook Graph API workspace：<https://www.postman.com/meta/facebook/overview>
- 微博开放平台与官方 CLI：<https://weibo.com/openapi>、<https://open.weibo.com/cli/index>
- 哔哩哔哩开放平台：<https://openhome.bilibili.com/doc>
- Steam 发布、评论与流量：<https://partner.steamgames.com/doc/store/releasing?language=english>、<https://partner.steamgames.com/doc/store/getreviews>、<https://partner.steamgames.com/doc/marketing/traffic_reporting>
- TapTap 开发者中心：<https://developer.taptap.cn/docs/store/>、<https://developer.taptap.cn/docs/store/release/publish/create-game/>、<https://developer.taptap.cn/docs/agreement/>
- itch.io butler 发布与 Analytics：<https://itch.io/docs/butler/pushing.html>、<https://itch.io/docs/general/about>
- Epic Games Store 分发：<https://store.epicgames.com/distribution/>
- Twitch API 与 EventSub：<https://dev.twitch.tv/docs/api/>、<https://dev.twitch.tv/docs/eventsub/>
- Nintendo Developer Portal：<https://developer.nintendo.com/>
- arXiv API、投稿规则与 endorsement：<https://info.arxiv.org/help/api/index.html>、<https://info.arxiv.org/help/submit/index.html>、<https://info.arxiv.org/help/endorsement.html>
- OpenAlex API：<https://help.openalex.org/api/>
- OpenReview API 与 Invitation：<https://docs.openreview.net/getting-started/using-the-api>、<https://docs.openreview.net/getting-started/using-the-api/objects-in-openreview/introductions-to-invitations>
- Semantic Scholar Academic Graph API：<https://api.semanticscholar.org/api-docs/graph>
- Crossref 与 DataCite REST API：<https://support.crossref.org/hc/en-us/articles/214320426-REST-API>、<https://support.datacite.org/docs/rest-api>
- Zenodo REST API 与 sandbox：<https://developers.zenodo.org/>

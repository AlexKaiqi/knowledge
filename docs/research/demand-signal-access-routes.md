# 需求信号访问路线调研

状态：active research；Apple 公开应用搜索已 live 准入；DataForSEO Google Organic SERP、Google Places 公开地点评论、DataForSEO Google Reviews 深样本、Appfigures 公开 App 评论与 Coresignal Jobs 为不可路由 candidate，尚未取得身份或完成 live 验证  
核验日期：2026-08-27

## 1. 决策

“接入 Google、闲鱼、58 同城、BOSS 直聘”不是四项能力。真正需要的是若干可独立工作、可单独验证的需求研究切片：

```text
定义研究问题与观察窗口
→ 发现候选结果
→ 读取有界样本或增量
→ 去身份化并保留来源证据
→ 提炼需求/痛点/替代方案/价格或技能信号
→ 由第二来源或产品实验验证
```

同一平台的公开研究、自有资产反馈和平台写入必须拆开。付费服务可以隔离代理、解析、验证码和页面漂移，但不会自动取得目标平台授权；因此每条路线同时需要：

1. **技术可达性**：能否按固定输入返回稳定、可解释、可对账的结果；
2. **授权可达性**：账号、数据用途、自动化、保留和商业使用是否在平台与供应商合同允许范围内。

任意一门未通过，只能是 research proposal，不能成为 verified Connector 或 canonical Capability。

## 2. 相对独立的能力切片

| 候选能力 | 解决的问题 | 最小输入 | 稳定输出 | 首个验证 |
| --- | --- | --- | --- | --- |
| `research.read-web-result-page` | 某个问题在公开 Web 上有哪些高信号页面、社区或竞品 | query、locale、geo、time window、limit | 有界 SERP、排名位置、标题、URL、摘要、observedAt、`complete=false` | 同一组固定 query 在一个付费 sandbox/live route 返回可重开结果；验证地域、分页、计费和空集 |
| `research.read-search-interest-series` | 一个主题的相对关注度何时、何地变化 | terms、geo、granularity、window | 统一缩放的相对兴趣序列、region、sampling/coverage 限制 | 获得 Google Trends API alpha 资格后用固定词验证；资格前不做 API Connector |
| `feedback.read-owned-search-query-delta` | 用户通过什么搜索词找到我们的站点 | verified property、dimensions、window、checkpoint | query/page/country/device 的 clicks、impressions、CTR、position 与不完整声明 | Search Console 只读 OAuth；验证合法空集、top-row 截断与 checkpoint |
| `research.read-public-place-review-snapshot` | 本地服务或竞品门店近期有什么问题和需求 | place/query、geo、language、sort、limit | 有界评论观察、星级/时间与明确 coverage；能否去作者身份和持久化由来源条款决定 | Google Places 官方 route 只能瞬时、完整署名展示最多 5 条 relevance sample；持久 Research Dossier 另做去身份化非逐字转化 |
| `feedback.read-owned-business-review-delta` | 自有 Google Business Profile 新增了哪些评论与回复状态 | verified location、sort、page token | average rating、total、去作者身份评论、更新时间、reply state、checkpoint | Business Profile 官方 OAuth，只读 verified location；page size 不超过 50 |
| `research.search-public-app-catalog` | 哪些公开 App 与目标问题、竞品或类别相关 | query、storefront country、device surface、limit | 有界应用 ID、开发者、类别、版本/时间、价格、评分摘要与非排名 coverage | Apple 文档化 Search API 已完成 US iPhone 小页 live probe；Google Play 和商业备援另行验证 |
| `research.read-public-app-review-snapshot` | 竞品 App 的用户抱怨、需求、版本与关键词信号 | store、app ID、territory、date/rating/query、limit | 去作者身份评论、rating、version、locale、date、source ref、coverage | 从 AppFollow/Appfigures/AppTweak 选一条付费路线；先验证一个固定竞品和一个 territory |
| `feedback.read-owned-app-review-delta` | 自有 App 新评论、版本/设备问题和回复状态 | store、owned app ID、checkpoint | 去作者身份评论、rating、locale、app version、粗设备类别、reply state | Apple/Google 官方只读 API 分别验证，不能共用一个 Connector |
| `research.read-classified-listing-snapshot` | 闲置交易或同城供给中有哪些价格、出售原因、故障、缺件和替代需求 | platform、query、coarse geo、price/window、limit | 去卖家身份的 listing 样本、价格、公开属性、主题、URL/digest、`complete=false` | 闲鱼与 58 分成两个 probe；首屏/最多 20 条，不取联系方式、不解决验证码 |
| `research.read-job-posting-snapshot` | 市场正在为哪些流程、技能、工具和难点付费 | source/route、query、geo、date、limit | 去招聘者身份的职位、公司、薪资区间、技能、职责/痛点主题、URL、coverage | BOSS 只能在书面授权或供应商合同覆盖目标域后 probe；否则改用合规聚合职位数据 |

评论原文、职位描述和商品描述只在受限研究运行中短期处理。长期研究证据优先保留必要摘录、digest、主题、稳定 ID/URL 和 observedAt；不得建立评论者、卖家或招聘者身份图谱。

## 3. Google 不是一条路线

### 3.1 通用 Web 搜索

Google Custom Search JSON API 已对新客户关闭；现有客户只能使用到 2027-01-01。它已作为 suspended migration-only route 记录，不再适合作为新 Connector 或采购首选。Google 给出的替代方案中，Vertex AI Search 适合最多 50 个指定域，不等价于完整 Web 搜索。

当前可购买的通用 SERP 路线：

| 路线 | 当前公开价格 | 能力与限制 | 结论 |
| --- | --- | --- | --- |
| DataForSEO Google Organic SERP | Standard `$0.6/1K` 个 10-result SERP；Priority `$1.2/1K`；Live `$2/1K`，深度和特殊参数另计 | 强制 locale/location；队列或 live；适合批量、低成本 query pack | 首选付费 probe 候选；先做 sandbox，再用最小充值 live 验证 |
| Bright Data SERP API | 5K requests/月免费；PAYG `$1.5/1K` successful requests；Scale `$499/月` 含 380K | JSON/HTML/Markdown、地理定位、解析/解锁、失败不计费 | 适合需要稳定实时结果与供应商维护的路线；合同仍需审查目标用途 |
| SerpApi | 免费 250/月；`$25/月` 1K、`$75/月` 5K、`$150/月` 15K | Google Search、Maps、Play、Trends 等多种引擎；cached/failed 不计入；文档 demo key 的固定请求于 2026-08-27 实测 HTTP 401 | 仍适合账号内快速小样本验证，但不能依赖公开 demo；必须先创建自有账号/API key |
| Oxylabs Web Scraper API | 免费最多 2K results；Micro `$49/月`，Google `$1/1K` non-JS results；更高阶梯降价 | Google/Baidu/Bing/Yandex，JSON/HTML、代理和解析 | 作为第二故障域候选；不在首轮同时接四家 |

公共输出必须保留 `query/geo/locale/observedAt/rank`，并声明 SERP 会受时间、地域、语言、设备和供应商解析影响。搜索结果不是互联网全集，也不能用供应商估计的总结果数推断市场规模。

#### 当前 candidate 实现

`connectors/dataforseo-google-organic-serp/` 已实现未来 `research.read-web-result-page` 的第一条隐藏路线，但 `conformance.status=candidate`，Gateway 不得选择。首版有意只覆盖单个 Google Organic observed page：

- 固定 `sandbox.dataforseo.com` 或 `api.dataforseo.com` 的 live advanced endpoint，调用者不能注入 URL；
- Basic Auth 只从 `api-basic` credential slot 注入，不接受聊天/input 中的 login/password；
- 每次一个 task、最多 10 个 organic result、无 retry；
- 拒绝 `site:`、`inurl:`、`filetype:` 等 5× 计费操作符；不暴露 `search_param`、crawl pages、AI overview、pixel rectangles；
- 校验 query/location/language/device echo、URL/domain、response bytes 与实际 task cost；
- 公共 projection 删除供应商名、task ID、原始 response 和结果总量估计，始终声明 `complete=false`。

对应 Collector 只观察官方认证、接口、sandbox 和价格语义以及 verification freshness；它的预算是 `$0`，不会自动执行付费 probe。sandbox/live runner 只把结果写进被忽略的 `.staging/`，不能自动创建 OKF 文件。

仍需人工批准的动作依次是：创建/确认 DataForSEO provider account 与使用条款、在外部 credential store 建立 opaque ref、登记 provider probe identity/pool、运行免费 sandbox、批准最多 `$0.01` 的三条 live query、与 provider ledger 对账，并审查商业研究/持久化用途。以上任一步未完成时，平台完整闭环仍按 0 计算。

### 3.2 搜索趋势

Google Trends API 当前仍是 very limited alpha，需申请并获选。它提供最近五年的一致缩放兴趣数据、日/周/月/年聚合和地域分解，但不是绝对搜索量。未获资格前只保留申请 proposal；不能把非官方 Trends 抓取包装成官方能力。

若短期必须验证需求方向，可用 SERP、Google Ads Keyword Planner（需广告账号）或第三方 keyword 数据交叉判断，但这些是不同测量对象，不能强行合成一个“搜索量”。

### 3.3 自有站点搜索词

Search Console Search Analytics 是稳定且高价值的 owned route：只访问已验证 property，OAuth readonly，输出 clicks、impressions、CTR 和 position。它只返回 top rows，`rowLimit` 最大 25,000，不能保证完整；因此能力名必须是 delta/top-query observation，不能叫“读取全部搜索数据”。

### 3.4 Google Maps / Business 评论

三条路线的语义不同：

| 路线 | 覆盖 | 适合 | 不能做什么 |
| --- | --- | --- | --- |
| Places API Place Details | 每个 place 最多 5 条 reviews，按 relevance | 公共门店的极小、可官方验证观察 | 不能取完整历史或稳定增量；不能删除作者后继续展示/保存评论原文 |
| Business Profile Reviews API | 自有、已验证 location；page size 最大 50 | 自有门店评论增量、回复和 rating 对账 | 不能研究任意竞品 |
| SerpApi / DataForSEO Google Reviews | 公开地点分页、排序和更深 review 样本 | 竞品/市场研究，付费隔离解析 | 第三方服务不等于 Google 授权；作者字段必须删除，合同和用途需审查 |

SerpApi 的 Google Maps Reviews route 支持 `newestFirst`、rating sort、query 和 next-page token；DataForSEO 按每 10 条评论计费、最大 depth 4,490，并有免费 dummy sandbox。首轮应先用 sandbox 验 Schema，再决定是否购买 live；不要为了“全量”默认拉取作者资料、图片和 contributor history。第三方 route 的合同若允许形成研究投影，应在 Connector 中删除作者身份；这条规则不能反向套给 Google Places 原生评论，因为 Google 明确要求显示评论时保留作者 attribution 和单条 `googleMapsUri`。

#### 当前 Google Places candidate 实现

`connectors/google-places-public-reviews/` 已实现官方最低深度 baseline，但 `conformance.status=candidate`，Gateway 不得选择：

- 第一次 POST Text Search (New)，固定 `X-Goog-FieldMask: places.id`、`pageSize=1`、language/region 和 circle bias；调用者不能注入 endpoint、field mask、page token 或 place ID；
- 第二次 GET 该首个结果的 Place Details (New)，字段固定为 place identity/display、rating/count、`reviews` 与 attributions；最多一个 billable details request、无 retry；
- Text Search ID-only 当前价格页标为 unlimited/no-charge；`reviews` 触发 Place Details Enterprise + Atmosphere，当前每月前 1,000 次免费，首个付费阶梯 `$25/1K`，单次 probe 硬限 `$0.03`；
- Google 的 location bias 可能被 query 中的明确地点覆盖，且首个 result 未经调用者确认；输出固定声明 `placeIdentityConfirmedByCaller=false`、`complete=false` 和 `order=provider-relevance`；
- 运行结果只允许 `ephemeral-attributed-display-only`：每条 review 保留完整 author attribution、单条 Google Maps 链接、举报链接和法国 `visitDate`，同时禁止身份图谱；
- Git verification redaction 不保存 place ID/name/address、评论/作者、rating、时间、URI 或 raw result digest，只保存请求/响应结构、归因和 transient-boundary 的布尔证据。

这不是“去作者身份评论数据集”。若一次证据化调研要保留长期结果，Research Agent 只能在活跃调用内产生经审阅的去身份化非逐字 finding 和 evidence reference，不能复制 Places 内容或作者，也不能把 content digest 当成规避缓存限制。专职 Collector 观察 Text Search、Place Details、Review Schema、attribution/cache policy、field billing 和价格六个官方面；在 Google Cloud/billing、受限 key、身份、Maps Platform/EEA 条款、公开 Terms/Privacy/Google Maps 归因界面与 `$0.03` live probe 全部获批前，只生成 proposal。

#### 当前 DataForSEO Google Reviews candidate 实现

`connectors/dataforseo-google-public-reviews/` 是同一公共结果能力的独立深样本故障域，不是 Google Places 的自动 fallback，也不向 OKF 暴露供应商：

- 只接受一个 establishment query、DataForSEO location/language code，固定 `depth=20`、`sort_by=newest`、`priority=1`；拒绝高级搜索操作符、callback、tag、任意 endpoint 和其它排序；
- POST 成功后只保存隐藏 task state 与 opaque operation ref；标准队列当前最长 45 分钟，由外部 suspend/resume executor 按精确 task ID 恢复。Connector 自己不 sleep、不 retry，也不为 pending/ambiguous outcome 重提付费 task；
- 当前标准价是每 10 条 `$0.00075`，20 条理论上限 `$0.0015`，Connector 与 live probe 硬限 `$0.002`；GET 结果在 30 天内免费，但只允许为了完成这一次 bounded operation 读取；
- DataForSEO 原始字段含 reviewer name/profile/image、Local Guide、历史评论/照片数、review ID、图片和 owner answer。公共 projection 全部删除，只保留瞬时 review text、rating、time、direct evidence link 与 `ownerResponsePresent` 布尔值；
- verbatim 可能包含评论者自述的个人数据，只允许活跃研究窗口，Git redaction 不留 query/place/review/operation/result digest。持久 Research Dossier 只能保存经人审、非逐字、去身份化概括和 evidence ref；
- 供应商 2026-06 条款明确将 originating search-engine 条款与权利风险留给客户；Google Maps end-user terms 又限制复制和 bulk feed。因此账号/Terms、API credential、identity、双方条款与数据保护判断、免费 sandbox、重复任务保护和 `$0.002` live probe 必须分别批准。购买访问不能被写成 Google 授权。

免费 sandbox 只用固定 dummy GET 验证 shape 和去身份，不验证 task POST、真实 query、freshness、Google use basis 或计费。它通过后仍是 candidate；只有 production-public probe 完成 exact task/cost reconcile 并经人工准入，Gateway 才可能选择。

### 3.5 Google Play

- **自有 App**：Android Publisher Reviews API 提供 list/get/reply。读取结果含作者名、正文、星级、语言、设备、OS、App 版本与时间；Connector 必须删除作者名、精确设备型号等非必要身份/指纹字段。回复是独立写能力，需要不可变 revision、确认和 receipt。
- **公开竞品**：Google Play Developer API 没有任意竞品评论搜索接口。可购买 AppFollow、Appfigures 或 AppTweak；公开竞品 route 必须和 owned API 分开。

## 4. App Store / Google Play 付费研究路线

### 4.0 公开应用搜索基线

Apple 的文档化 Search API 已完成第一条无需账号的公开应用检索闭环。公共能力 `research.search-public-app-catalog` 只接收 query、两位 storefront country、`iphone|ipad|mac` surface 和 `limit≤25`；结果只保存应用身份、开发者、类别、版本与时间、价格、评分摘要和 canonical store URL。Connector 固定单请求、三秒间隔、不 retry，不保留 description、release notes、artwork 或原始响应。

2026-08-27 对 US iPhone `ChatGPT` 的 live probe 返回 5 条并包含 App ID `6448311069`。这只证明一个小页当前可工作：官方文档已进入 Documentation Archive，API 没有定义返回顺序的排名含义，`resultCount` 也只是当前页长度。能力固定声明 `corpusComplete=false`、`historical=false`、`rankingSemantics=apple-search-api-unspecified`，不能用评分数或返回顺序直接证明需求、份额或榜单。

Google Play 没有发现对应的官方任意竞品搜索/评论 API；Android Publisher Reviews API 是带 `androidpublisher` 授权的自有 package 路线。商业备援分两条保留：Appfigures `/products/search/{term}` 需要 Public Data add-on 与 `public:read`；42matters iOS Search 当前每次 3 hits、Tiny 以上套餐，并明确结果使用供应商算法、不同于 App Store 顺序。两条都未建立 Connector、账号、合同/用途判断或 live 对比，不可自动选择。

Apple 的 `customerreviews` RSS 技术端点当前仍会响应，但没有找到当前官方页面证明该具体 feed 是“approved Apple RSS feed”并文档化其 Schema、限流和用途。结合 App Review Guidelines 4.5.1 对抓取和派生 ranking 的限制，该路线保持 suspended；不能因为 HTTP 200 就准入竞品评论能力。

| 供应商 | 已确认能力 | 计费/准入 | 适用判断 |
| --- | --- | --- | --- |
| AppFollow | App Store/Google Play 公开与自有 reviews、keyword tracking、ranking、update monitoring；Reviews API v2 每请求 10 credits | 有 free/trial 和订阅；API credit 月度重置；具体套餐在购买时复核 | 偏 review management 和自有回复闭环；公开采集频率与连接方式差异明确 |
| Appfigures | `/products/search/{term}` 搜索 Apple/Google 产品；`/products/{store}/{id_in_store}` 可解析内部 product ID；`/reviews` 支持 country、date、stars、query | 竞品需 Public Data API add-on 和 `public:read`；product metadata 2 credits、reviews 3 credits；商业产品/客户处理/AI training 可能需单独许可 | 评论已实现不可路由 candidate；搜索只作商业备援研究。两者都必须删除 provider ID、author、artwork 与 route 细节 |
| AppTweak | 两店 reviews search/stats、keyword volume/rank、live search、metadata/history、download/revenue estimates | credit subscription；7 天 trial/100K credits；公开价格依计划，企业可定制 | 适合 ASO、竞品和评论一体研究；范围最大，采购前先用固定问题评估是否过度 |
| 42matters | Google Play、App Store 等 app metadata、search、advanced query、top charts、rank history、文件 dump | iOS search 当前 3 hits/request、5 QPS、Tiny 或以上；trial token 可先做 5 条小样本 | 更偏结构化市场元数据；其 search rank 是供应商算法而非 App Store order。适合 Apple route 失败或需要复杂过滤时比较，不作为评论首选 |

选择标准不是字段最多，而是固定研究问题下的 coverage、新鲜度、territory 语义、可导出性、作者去除、商业使用许可和单位 query 成本。首轮只对同一固定 App/territory/date window 比较 1–2 家，不同时采购所有供应商。

### 4.1 当前 Appfigures candidate 实现

`connectors/appfigures-public-app-reviews/` 将供应商内部 product ID 藏在 Connector 内：公共输入只使用 `store + Apple ID/Google package name + date window + optional rating/query`，先固定解析产品，再执行一个 newest-first review request。首版边界：

- 只接受 Personal Access Token credential slot 与 `public:read`；不接受 client key/token input，不实现 OAuth 公共客户端；
- Apple 必须声明两位 territory；Google Play 明确拒绝 country filter，并把 `ZZ` 表达为 `country-unavailable`，不伪造成国家；
- 每次最多 25 条、窗口最多 90 天、固定第一页，不翻页、不自动轮询 202、不重试；
- 删除 author、供应商 review/product ID、重复 original text、`has_response` 和 provider route；公开竞品的开发者回复状态固定为 unavailable；
- 预计最多 5 Public Data credits，但 endpoint 不返回实际 debit，因此 probe 分成执行与账单 reconcile 两步；对账前 outcome 只能是 `partial`；
- verification snapshot 只保存 review title/body 的长度与 SHA-256，不保存评论原文。

Collector 以 `$0` 预算观察认证、store-ID resolution、review filters/territory、日请求限额、credit 单位和 commercial-use 条款。仍需人工批准：内部研究账号、API Client/PAT、Public Data add-on、至少 5 credits、采购单中的 credit 单价、provider probe identity/pool，以及“仅内部产品研究”的用途判断。任何对客户处理、公开数据产品、转售/重包装或 AI training 的使用，必须先取得 Appfigures 的单独书面商业许可。

### 4.2 真实 Agent 场景调研

证据化调研能力已在 `platform-integration` 场景实际运行两次，并通过同一 Research Dossier Schema。App 评论运行保留 Appfigures 的固定 5-credit probe，但把最低购买价格、内部用途许可、provider identity 和真实账单扣减保留为执行前阻断项；AppTweak 与 AppFollow 只作为失败后的比较路线。闲鱼运行则得出相反类型的结果：社区 Actor 虽然技术输入和低额计费明确，但目标平台自动获取授权门失败，因此不创建 Connector。调研能力的产物是有证据的决策，不以“接入数量增加”为成功条件。

该观察没有创建账号、接受条款、购买 credits 或读取真实评论，只证明研究能力能把一个平台接入问题转成可审阅决策。跨 runtime 重复稳定性和真实 API coverage 仍需分别验证。验证产物见 `knowledge/verifications/research/evidence-backed-research/platform-integration-snapshot.json`。

同一能力随后对 Google、闲鱼、58 与 BOSS 相关路线做了组合裁决：DataForSEO 只推进到 sandbox；闲鱼只保留一页用户可见 proposal；58/BOSS direct 自动路线因目标平台授权边界暂停；岗位需求只推进不声称 BOSS coverage 的 Coresignal 多源候选。该档案把付费供应商访问、目标平台权限、身份/计费门和下一 probe 分成不同事实，没有创建新平台 Connector，也没有把 candidate 写成可用能力。验证产物见 `knowledge/verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json`。

## 5. 闲鱼

已有独立调研见 [闲鱼公开市场信号接入调研](xianyu-market-signals.md)。本轮补充四条收费/授权事实：

| 路线 | 当前事实 | 风险判断 |
| --- | --- | --- |
| Apify `piotrv1001/xianyu-goofish-listings-scraper` | feed 可匿名；keyword search 要求用户扫码后上传 Playwright storage state；listing `$2/1K`、detail `$6/1K` | 不接受把自有闲鱼/Taobao 会话上传给社区 Actor 作为默认路线；session 2–3 天过期，维护和凭据泄露面过大 |
| Apify `gantianca/xianyu-goofish-search` | keyword/page/sort/price 输入，无闲鱼登录；`$0.01/search` 加 `$1/1K` results；供应商声明使用住宅代理轮换 | 技术可行但暂停。闲鱼法律声明要求事先许可并明确限制机器人/蜘蛛获取内容；付费与无需登录都不能替代目标平台授权 |
| Apify `gio21/goofish-scraper` | URL/item ID detail，无登录；`$5/1K` products；可经 REST/MCP | 适合已知 URL 的 detail 对账，不解决关键词发现；输出含 seller，Connector 必须删除 |
| Apify `zen-studio/goofish-xianyu-search-scraper` | 匿名 keyword/search URL、地域/新鲜度/排序，免费 20 次×30 条；曾出现 freshness/coverage issue 并修复 | 可作为付费候选故障域，但 issue 证明排序和 freshness 不能只信声明；需逐字段 live probe，禁止保留 GPS 与卖家资料 |

付费 Actor 是社区软件，不是闲鱼授权合作方。首选仍是用户主导、界面可见、低频、首屏的小样本浏览器 proposal。自动 Actor 即使匿名且无需 session，也必须先取得目标平台对预期自动研究用途的书面许可；任何要求导入会话、代理轮换、验证码求解或长期身份追踪的路线在当前目标下拒绝。

## 6. 58 同城

58 的官方开放平台真实存在，但面向合作方经营闭环：招聘、房产、二手车和本地服务的信息发布/更新、预约/商机、消息通知等。它可以成为未来“在 58 发布自有服务/招聘/房源并读取自有经营回执”的 official partner route，不能据此声称可搜索和导出任意公开市场。

58 用户协议同时明确：未经 58 事先书面同意，不得商业利用站内数据。这使公开 listing 研究必须先获得书面用途确认；付费爬虫不能替代该门。

可购买路线：

- Bright Data 有专门 `58.com Scraper`/Scraper Studio，公开价 5K free page loads，PAYG `$1.5/1K`、`$499/月` 时 `$1.3/1K`；可 JSON/CSV/API/Webhook 交付。
- Apify 有社区 `58.com Scraper`，约 `$3.99/1K` results；维护者、使用量和评分信号弱于 Bright Data。
- 某些社区 Actor 明确宣传解密字体、住宅代理和自动解滑块。即使价格更低，也不进入候选，因为它主动规避平台技术措施，还试图收集 seller/landlord 信息。

结论：

1. **公开研究**：Watch，先向 58 申请/确认商业研究授权；获批后用 Bright Data 做最多 20 条、无联系人的 live probe。
2. **自有发布/经营**：独立的 official partner candidate；只有出现真实本地服务、招聘或二手发布计划时才申请开放平台。
3. **替代来源**：若研究问题是同城需求而非必须来自 58，优先使用政府开放数据、公开论坛、搜索 SERP、用户访谈或自有 landing page 实验，避免被单一平台授权阻塞。

## 7. BOSS 直聘

BOSS 的公开用户协议明确禁止未经许可通过第三方工具浏览职位、使用 spider/爬虫/拟人程序获取平台信息。BossHi 有 REST API 与事件，但它是企业协作/小程序开放平台，没有证据表明它提供公共职位搜索与批量导出。因此不能建立“BOSS 官方职位搜索 API”候选。

技术上存在两类收费路线：

- Bright Data 有 BOSS Zhipin Scraper Studio route，5K free credits/page loads，通用 PAYG 约 `$1.5/1K` records/page loads；供应商处理代理、渲染和解析。
- Apify 曾有 `$25/月 + usage` 的社区 BOSS Actor，但已经 deprecated，且示例直接返回招聘者姓名、头像和 ID，不合适。

Bright Data 的存在证明“可以买到技术执行服务”，不证明 BOSS 允许我们的具体用途。当前决策：

1. BOSS direct route 保持 **blocked/watch**，直到取得 BOSS 书面许可或 Bright Data 能提供覆盖本用例、目标域和责任边界的合同证据，且经法律/合规复核。
2. 若目标是“发现市场愿意为哪些能力付费”，先使用不绑定 BOSS 的付费 Jobs Data API。当前第一候选是 Coresignal Multi-source Jobs API；Bright Data Jobs Data API 保留为第二故障域。两者都必须在采购前确认中国职位与来源覆盖，不能从“multi-source”反推包含 BOSS。
3. Job posting 只保留职位、公司、粗粒度地点、薪资区间、技能、职责和必要的来源类别/provenance；删除 recruiter name/avatar/contact、source-specific ID/URL、精确地理坐标和候选人信息。

### 7.1 Coresignal 职位需求 candidate

`connectors/coresignal-job-posting-snapshot/` 已实现为不可路由 candidate，公共能力仍叫 `research.read-job-posting-snapshot`，供应商名和执行协议不会进入 OKF。选择它作为第一条 BOSS-independent 路线的原因是当前官方契约足够具体：Multi-source Jobs 有固定 search/collect endpoint、字段选择、active/expired 状态和响应 credit header；公开价格为 search 免费、每个成功职位 collect 1 credit，trial 当前写为 7 天/2,000 credits，Mini 为 `$49/月`/2,500 credits。

首版边界：

- 输入只接受 phrase、country、最多 30 天窗口和 `limit≤10`；Connector 编译固定 Elasticsearch DSL，强制 `status=1`、`job_id_expired=0`，调用者不能传 DSL、分页 token、source 或字段列表；
- 只跑一页免费搜索，再串行 collect 最多 10 个 ID；不 retry，不使用一次 20 credits 的 Search Preview；每个 response 都必须有 `x-credits-remaining`，最终 debit 必须与成功 collect 数完全相等；
- collect 只请求白名单字段；输出删除 recruiter、profile/contact、source IDs/URLs、external URL、经纬度、公司地址和 provider ID。职位描述运行时只留 1,000 字 excerpt+digest，Git probe candidate 只留长度与 SHA-256；
- 输出始终声明 `complete=false`、source mix undisclosed、target-platform coverage unverified。空集合只证明固定查询没有返回记录，不能证明中国没有需求或供应商没有中国数据。

当前仍不能执行：账号/试用创建会接受身份与条款，网站条款还明确购买 Data 由单独 legal agreement 管理；API key、probe identity/pool、最多 10 credits/`$0.25` 等价预算、中国覆盖检查都需要人工批准。通过 live probe 和 Data agreement 审查之前，不创建 OKF capability/schema，不计入完整闭环。

## 8. Probe 与采购顺序

隐藏路线目录已结构化为 `connectors/demand-signal-access-routes/routes.json`：共 27 条 verified/candidate/research/suspended 路线。Apple Search API 是唯一 `verified/full` 且 automatic-selection eligible 的路线；DataForSEO SERP、Google Places、DataForSEO Google Reviews、Appfigures 评论、Coresignal Jobs 与 OpenConnector/TikHub public-social component 是已有实现但未获 live 准入的 candidate。OOMOL managed public-social、Appfigures/42matters 搜索、Apple/Google owned reviews 与 Bright Data Jobs 保持 research；Apple 未文档化 customer-review RSS、Google Play direct public search/reviews、Google Custom Search 迁移路线，以及闲鱼/58/BOSS 未授权自动路线保持 suspended。`demand-signal-route-maintainer` 以零费用观察 26 个官方/供应商页面；OpenConnector 专职 Collector 观察 7 个 runtime/action/security/verification/价格/托管 Skill/同名项目来源、2 个 HEAD 和 1 个规范化 tag set。所有 Collector 只生成 proposal，不创建账号、不启用 free credit、不自动执行 probe。

采购以最小信息增益为单位，不以“买个平台套餐”开始：

| 顺序 | Probe | 预算边界 | 通过标准 | 失败后动作 |
| --- | --- | --- | --- | --- |
| 完成 | Apple Search API 固定 US/iPhone/ChatGPT | `$0`；一个请求、最多 5 条 | App ID `6448311069`、最小元数据、非排名/非完整边界与 Schema 通过 | 七天复验；失败才比较 Appfigures/42matters，不抓取 App Store |
| 1 | DataForSEO Google Organic sandbox + 3 个 live query | sandbox `$0`；live response-reported 总额硬限 `$0.01` | locale/geo/rank/URL/时间稳定，固定 query 可重放，计费可对账 | 再试 SerpApi free，不直接上大套餐 |
| 2 | Appfigures 固定 ChatGPT Apple/US 公开评论 | 最多 5 credits、等价成本硬限 `$1`；执行前后人工记录 credit ledger | 30 天/最多 25 条；rating/version/date/territory 清楚；author、内部 ID、response state 与 durable text 完全删除；账单已对账 | 换 AppTweak/AppFollow 第二路线比较，不自动购买 |
| 3 | Google Places 固定 public place | 一次 ID-only search + 一次 Place Details；硬限 `$0.03`，核对 Google Cloud usage/billing | 最多 5 条 relevance sample；完整署名/单条来源链接；原文与作者只瞬时，Git redaction 无 Places 内容 | 保持 candidate；先批准 Terms/Privacy/归因界面与 identity，需要更深样本才评估 SerpApi/DataForSEO |
| 4 | DataForSEO 固定 public place 深样本 | 免费 dummy sandbox 后，一次 standard task、精确 task GET 与 charge reconcile；硬限 `$0.002`，禁 auto-recharge/重复提交 | 最多 20 条 newest-first；去 reviewer/owner identity，verbatim 只瞬时，Git redaction 无内容；供应商访问≠Google 授权 | 保持 candidate；先批准双方条款/用途/数据保护、account/credential/identity 和 suspend/resume executor |
| 5 | 闲鱼可见浏览器首屏 | 0 元；最多 20 条，不翻页 | 无登录或用户明确自有会话；商品可重开；无卖家/GPS/contact | 不用社区 Actor 自动 fallback；先 proposal |
| 6 | Coresignal 固定中国 AI assistant 职位 | 最多 10 credits、等价成本硬限 `$0.25`；执行前后逐 response 对账 | active/non-expired、最多 10 条；去 recruiter/source route；Data agreement 与中国 coverage 有证据 | 保持 candidate；比较 Bright Data Jobs，不自动购买 |
| 7 | 58 / BOSS direct | 0 元技术执行，先做授权询证 | 取得书面允许范围、数据保留/商业用途、目标域和账号边界 | 未获授权保持 Watch，继续用独立 jobs dataset |
| 8 | OpenConnector/TikHub 固定小红书关键词 | 最多一个初始页、无 retry；TikHub/OOMOL 等价成本硬限 `$1` | v1.4.0 action/connection grant、真实 Schema、去身份投影、原始 payload 清理和费用对账全部通过 | 保持 candidate；不导入 provider catalog，不自动切 OOMOL managed route |

所有 paid probe 都必须设置 opaque credential ref、请求/金额硬上限、失败不重试或有限重试、原始数据短 retention、日志脱敏和月度账单对账。采购、接受条款和上传任何平台会话均需人工批准。

## 9. Collector 维护范围

需求信号 Collector 只维护：

- 官方 API、用户协议、权限和访问申请语义；
- 付费供应商 endpoint、价格单位、trial、commercial-use/license、数据来源和输出 Schema；
- 已选 route 的 live probe 新鲜度、coverage、计费、字段漂移和 incident；
- 候选 route 是否真正形成独立故障域，以及是否开始要求登录、验证码、身份字段或更激进的绕过。

价格变化只生成 proposal，不自动购买或切换供应商。社区 Actor 的“合法”“合规”“全量”是供应商声明，不是我们的验证结论；Collector 必须同时观察目标平台条款和真实样本误差。

## 10. 来源

### Google 官方

- Custom Search JSON API：<https://developers.google.com/custom-search/v1/overview>
- Search Console Search Analytics：<https://developers.google.com/webmaster-tools/v1/searchanalytics/query>
- Google Trends API alpha：<https://developers.google.com/search/apis/trends>
- Google Business Profile API overview：<https://developers.google.com/my-business/content/overview>
- Business Profile reviews list：<https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list>
- Places API Place resource：<https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places>
- Android Publisher Reviews：<https://developers.google.com/android-publisher/api-ref/rest/v3/reviews>
- Android Publisher recent-review/CSV boundary：<https://developers.google.com/android-publisher/reply-to-reviews>
- Google Play monthly review exports：<https://support.google.com/googleplay/android-developer/answer/6135870>

### 付费 Web / Google 数据

- DataForSEO authentication：<https://docs.dataforseo.com/v3/auth/>
- DataForSEO Google Organic live advanced：<https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/>
- DataForSEO sandbox：<https://docs.dataforseo.com/v3/appendix/sandbox/>
- DataForSEO Google Organic pricing：<https://dataforseo.com/pricing/google-serp/google-organic-serp-api>
- DataForSEO Google Reviews：<https://docs.dataforseo.com/v3/business_data-google-reviews-task_post/>
- Bright Data SERP pricing：<https://brightdata.com/pricing/serp>
- Bright Data Web Scraper pricing：<https://brightdata.com/pricing/web-scraper>
- SerpApi pricing：<https://serpapi.com/pricing>
- SerpApi Google Maps Reviews：<https://serpapi.com/google-maps-reviews-api>
- Oxylabs SERP Web Scraper API：<https://oxylabs.io/products/scraper-api/serps>

### App 数据

- Apple Search API overview：<https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html>
- Apple Search API parameters/entities/limit：<https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html>
- Apple App Review Guidelines 4.5.1：<https://developer.apple.com/app-store/review/guidelines/>
- Apple App Store Connect customer reviews：<https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews>
- Appfigures authentication：<https://docs.appfigures.com/api/reference/v2/authentication>
- Appfigures products/store-ID resolution：<https://docs.appfigures.com/api/reference/v2/products-2>
- AppFollow API overview：<https://support.appfollow.io/hc/en-us/articles/360020833017-API-Overview>
- AppFollow Reviews API：<https://docs.api.appfollow.io/reference/reviews_api_v2_reviews_get-1>
- Appfigures Reviews：<https://docs.appfigures.com/api/reference/v2/reviews>
- Appfigures API/Public Data limits, credits and commercial use：<https://help.appfigures.com/en/article/appfigures-api-cli-and-mcp-access-limits-and-public-data-1seiibo/>
- Appfigures Public Data access：<https://docs.appfigures.com/public-data-access>
- AppTweak App Store API：<https://www.apptweak.com/en/app-store-api>
- 42matters iOS Search API：<https://42matters.com/docs/app-market-data/ios/apps/search>
- 42matters iOS Advanced Query：<https://42matters.com/docs/app-market-data/ios/apps/advanced-query-api>

### 闲鱼、58 与 BOSS

- 闲鱼社区用户服务协议：<https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html>
- 闲鱼社区法律声明：<https://terms.alicdn.com/legal-agreement/terms/suit_bu1_taobao/suit_bu1_taobao202103061039_91765.html>
- Apify no-session Xianyu search route：<https://apify.com/gantianca/xianyu-goofish-search>
- Apify Xianyu/Goofish listings route：<https://apify.com/piotrv1001/xianyu-goofish-listings-scraper>
- Apify Goofish detail route：<https://apify.com/gio21/goofish-scraper>
- Apify Goofish search route：<https://apify.com/zen-studio/goofish-xianyu-search-scraper>
- 58 开放平台：<https://open.58.com/>
- 58 用户协议：<https://help.58.com/home/announcement.html>
- Bright Data 58.com Scraper：<https://brightdata.com/products/web-scraper/58-com>
- BOSS 直聘用户协议：<https://www.zhipin.com/web/common/protocol/protocol-2019-09-30.html>
- BossHi API 调用流程：<https://histatic.zhipin.com/front/bosshi-mp-docs/service/ready/apiCall/callProcess/processOverview.html>
- Bright Data BOSS Zhipin Scraper：<https://brightdata.com/products/web-scraper/boss-zhipin>
- Bright Data Jobs Data API：<https://brightdata.com/products/data-feeds/jobs-data-api>

### OpenConnector / OOMOL

- OpenConnector verification state：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/verification.md>
- OpenConnector runtime API：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/runtime-api.md>
- OpenConnector credential storage：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/credentials.md>
- TikHub Actions：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/src/providers/tikhub/actions.ts>
- OOMOL Public Social Research Skill：<https://oomol.com/en/skills/@alwaysmavs/public-social-research/>
- OOMOL pricing：<https://oomol.com/en/pricing/>

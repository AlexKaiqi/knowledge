# 闲鱼公开市场信号接入调研

状态：active research；不是 canonical knowledge  
核验日期：2026-08-27

## 1. 为什么值得接入

闲鱼不是普通内容社区。商品标题、描述、成色、价格和出售原因把“用户有什么、为什么不用、愿意多少钱处理、缺什么配件或替代品”放在同一个真实交易语境中，适合发现以下信号：

- 某类产品的真实价格带、折价速度和供给密度；
- 高频出售原因、故障、兼容性、维护和配件需求；
- 用户描述同一问题时实际使用的词，而不是厂商术语；
- 新品热度与二手供给、降价、闲置之间的时间差；
- 现有产品被替代、改造、拆件或组合使用的方式。

目标不是“采集闲鱼”，而是交付一个有界的决策对象：

> 对一个明确产品/问题关键词，在固定地域、价格和时间观察条件下，返回小样本、去身份化、明确不完整的公开市场信号快照。

## 2. 候选能力切片

候选 ID：`xianyu.public-listing.read-market-signal-snapshot`

输入建议：

- query；
- 可选 price range；
- 可选 coarse region；
- sample limit，首个 probe 固定不超过 20；
- observation purpose，用于约束本次产品研究问题。

稳定输出建议：

- query、过滤条件、observedAt、sampleCount、`sampleComplete=false`；
- 价格的原生币种、可解析价格样本和有界分布；
- 商品成色、品类/品牌等公开属性的归一化计数；
- 去身份化标题/描述信号及主题，例如出售原因、故障、缺件、兼容性和替代品；
- 平台 item ID 或稳定证据 URL、内容 digest 和观测时间；
- 结果受排序、地域、登录态、个性化和下架影响的明确限制。

不得返回或长期保留：卖家昵称/ID/头像/主页、精确位置、Cookie/token、私信、联系方式、图片副本、跨商品身份关联或原始页面全集。原始标题/描述只在受限 staging 中短期处理；canonical 结果只保留必要的去身份化信号、短摘录或 digest。

## 3. 访问路线边界

| 路线 | 已确认事实 | 是否可承担候选切片 | 结论 |
| --- | --- | --- | --- |
| 闲鱼官方 Web 搜索/浏览 | 当前用户协议声明，未登录用户可以使用浏览、搜索等基础服务；`goofish.com/search` 当前匿名请求返回 200 页面 | 可能；但“用户可浏览”不等于授权自动化采集，且结果由浏览器渲染、可能个性化或触发登录/风控 | 首选为可见浏览器、小样本、低频、只读 research route；完成条款与 live 语义 probe 前不提升 |
| Apify `gantianca/xianyu-goofish-search` | 无闲鱼登录；keyword/page/sort/price；`$0.01/search` 加 `$1/1K` results；住宅代理轮换 | 技术可达，但闲鱼法律声明要求自动获取内容事先许可，供应商付费不等于目标平台授权 | 暂停；不创建 Connector、不采购、不运行，除非先取得可核验的书面许可 |
| 淘宝开放平台“闲鱼电商 SaaS” | 官方目录主要覆盖授权卖家/ISV 的商品、订单、评价、发布等经营能力 | 否；目录没有证明存在面向第三方公开市场研究的商品搜索 API | 只作为官方能力边界来源，不误用为公共搜索路线 |
| `fancyboi999/goofish-cli` | Apache-2.0；审阅 HEAD `771382c2ea3fd281b78c015bf2bf8ed68cc873ff`；Playwright/System Chrome 提供商品搜索和详情，也同时暴露 Cookie、私信和多项写操作 | 原语可用，权限面过宽 | research route；未来 adapter 必须只允许 search/view，禁止 auth 导出、IM、发布、删除、擦亮和自动回复 |
| `partme-ai/opencli` 闲鱼 adapter | Apache-2.0；审阅 HEAD `f802942c488368f2d65c16e638d7e32a74d2863b`；浏览器路线支持关键词、价格/地区过滤和详情，也支持 inbox、message、reply、publish | 原语可用，权限面过宽 | 独立 research route；只审计搜索/详情代码和浏览器权限，不安装、不启用其它命令 |
| 其它爬虫、签名 API 与监控项目 | 已发现 Playwright 拦截、内部 API、Cookie、并发分页、自动回复和价格监控等多种实现 | 暂不接受 | 只进入后续发现池；高并发、验证码绕过、代理轮换、长期存卖家身份或缺许可证的实现直接排除 |

开源许可证或商业供应商条款只说明代码/服务关系，不代表闲鱼授权浏览器自动化、住宅代理或内部 API。任何真实 route 都必须继续遵守目标平台条款、数据最小化、限频和账号所有权边界。当前证据化调研结论是：正常用户界面内的一页人工观察仍可提 proposal，自动关键词路线在书面授权前暂停。

## 4. 最小 live probe 提案

首个 probe 只验证“有界公开搜索快照”，不做详情批量展开：

1. 使用可见浏览器和一个与当前产品研究有关的固定关键词；优先尝试匿名基础搜索。
2. 只观察首屏或前 20 个公开商品卡片，不翻页、不并发、不重试验证码。
3. 若平台要求登录，停止匿名 probe；后续只能绑定用户明确授权的自有会话 credential ref，Cookie 不进入仓库。
4. 输出 item ID/URL、标题信号、价格、粗粒度地域、公开属性、观测时间和明确的 `sampleComplete=false`。
5. 删除卖家字段，拒绝私信、主页、联系方式和图片下载；不点击购买、收藏、想要或任何写操作。
6. 断言结果可以由同一浏览器会话重新打开一个样本卡片核对；HTTP 200、页面 shell 或内部接口响应都不能单独算通过。
7. 原始 DOM 只进入受限 staging，并按短 retention 清理；脱敏 ProbeReport 才能进 Git。

只有 probe 通过，才设计平台专属输入/输出 Schema 和 candidate Connector。失败时保留“信息源有价值、当前路线不可准入”的结论，不用更激进的爬虫绕过。

## 5. Collector 维护范围

若该候选进入 active research，Collector 只维护：

- 官方用户协议、隐私政策、公开搜索入口和登录边界的语义变化；
- 两条已审阅开源 route 的 HEAD、tag、许可证、归档、相关 issue 和最小权限面；
- live probe 新鲜度、页面结构/字段变化和风控失败分类；
- 新路线是否真的形成独立故障域，而不是又一层 MCP/CLI 包装。

Collector 不自动安装项目、不导入 Cookie、不登录、不翻页采集、不处理验证码、不切换代理、不发私信、不发布商品，也不自动修改 canonical knowledge。

## 6. 当前证据

- 闲鱼社区用户服务协议：<https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html>
- 闲鱼社区法律声明：<https://terms.alicdn.com/legal-agreement/terms/suit_bu1_taobao/suit_bu1_taobao202103061039_91765.html>
- Apify `gantianca/xianyu-goofish-search`：<https://apify.com/gantianca/xianyu-goofish-search>
- 淘宝开放平台闲鱼电商 SaaS API 目录：<https://developer.alibaba.com/docs/api.htm?apiId=73221&source=search>
- `fancyboi999/goofish-cli`：<https://github.com/fancyboi999/goofish-cli>
- `partme-ai/opencli` 闲鱼 adapter：<https://github.com/partme-ai/opencli/blob/main/docs/adapters/browser/xianyu.md>

# 产品目标与独立能力地图

状态：研究组合；不是 canonical knowledge  
核验日期：2026-08-27

## 1. 目标不是四个孤岛

当前四个目标：

1. 从评论、搜索、闲置交易、同城服务和招聘信息中发现需求；
2. 做一个长期可用的个人助理/宠物；
3. 发布游戏并获得分发；
4. 持续收集反馈并推动下一轮改进。

它们共同形成一个产品学习循环：

```text
Evidence-backed research
→ Difficulty / Opportunity proposal
→ build or content revision
→ controlled publication
→ receipt + release-state reconciliation
→ feedback / influence delta
→ evidence-backed decision
```

平台、工具、GitHub 项目和论文都是某个节点的路线。OKF 对外暴露的是经过验证的结果能力；Connector 隐藏执行细节；Collector 维护来源、路线、验证和 proposal。

## 2. 公共能力层

以下能力被两个以上目标复用，应该先抽象稳定结果，不先统一平台原始字段。

| 能力单元 | 输入 | 输出 | 副作用/边界 | 当前状态 |
| --- | --- | --- | --- | --- |
| `research.conduct-evidence-backed` | scenario、goal、decision、questions、budgets | 带 source claim、inference、反证和 stop reason 的 Research Dossier | 只读；结果必须人审，不能自动准入 | **已准入，local/experimental**；10 份 Schema-valid snapshot，其中 9 次为真实 Agent 场景运行，六类场景已覆盖。首个市场/竞品样本拒绝 Apple 目录市场规模与 companion quality 总分，选择 persona continuity eval；跨 runtime 重复性仍未验证 |
| `research.read-demand-signal-snapshot` | source class、query、geo/locale/window、limit | 明确不完整的去身份化评论/搜索/listing/job 信号 | 原文短 retention；禁止身份图谱 | **候选族**；Steam 评论页是一个已验证的平台专属实例 |
| `research.read-source-delta` | source、checkpoint、filters | 新增/更新/删除或 `unknown` 的证据项及 next checkpoint | 必须声明 checkpoint 和 late edit/delete 语义 | GitHub work-item 原语已验证；未形成跨来源万能能力 |
| `arxiv.search-public-eprint-metadata` | 纯 phrase、可选 category、sort、offset、limit≤20 | arXiv ID、标题/摘要/作者、版本时间、分类与官方链接 | **已准入 live**；三秒/单连接、metadata-only，offset 不是 delta checkpoint，论文主张必须人审 |
| `publication.prepare-owned-revision` | 自有 artifact、metadata、target constraints | immutable revision、preflight、digest | 不执行平台写入 | 游戏本地构建及 Steam asset/description/tag/content-survey/early-access/initial-base-price/initial-release-date/supported-feature/system-requirements 九个商店切片已准入；其余 metadata 仍按字段族独立建立 |
| `publication.submit-owned-revision` | approved revision、target identity、idempotency key | submission receipt 或明确 unknown result | 高影响写操作；逐 revision 确认；未知结果禁止盲重发 | 各平台候选；尚无完整发布闭环 |
| `publication.read-owned-release-state` | owned object ID、checkpoint | native state、normalized phase、transition time、blocking reasons | Apple/Google/Steam/TapTap 等各自 Connector | 候选；需要自有开发者身份 |
| `feedback.prepare-consented-intake-review-revision` | scope/product/form/notice revision、decision、purpose、submission、consent/privacy/retention evidence | 内容寻址 intake review revision 或显式 blockers | **已准入 local**；只冻结 caller-reviewed 声明，不检测 PII、不认证法律合规、不存储/回复/撤回或签发 receipt |
| `feedback.expire-consented-intake-record` | storage receipt、record digest、原始 retention policy/deadline、trusted grant、idempotency key | receipt-bound 逻辑删除与 retention deletion receipt | **已实验准入 local-write**；deadline 前无 grant/control write，due 后仍要求 `disposition=delete`、`holdStatus=clear`；Collector 只提案。固定未来时钟的隔离 probe 执行真实 unlink/sync，但生产 scheduler/grant/hold 未接，不声称介质/备份/下游清除或法律合规 |
| `feedback.read-feedback-delta` | owned/public target、checkpoint、filters | 去身份化 feedback entries、aggregates、next checkpoint、coverage | 公开研究、自有反馈和 private support 分开授权 | 候选族；Steam 已验证 cursor page → partial observation window，仍不是完整 delta |
| `steam.games.reviews.project-feedback-observation-window` | 已验证的 Steam 公开评论页 | 去正文/身份的 partial window、semantic digest、resume cursor 与覆盖限制 | **已准入 local**；cursor 不是全局 high-watermark，缺失不等于删除，checkpoint 固定 hold |
| `feedback.reconcile-feedback-observations` | prior/current 去身份化 observation windows | edit/reply/explicit delete/hidden/resurface 与 `missing-unresolved` | **已准入 local**；不从缺失推断删除，checkpoint 只提议推进；平台窗口完整性仍由上游证明 |
| `feedback.synthesize-feedback-theme-evidence` | bounded deidentified feedback evidence、question、decision | themes、sample-only counts、support/counter refs、conflicts、gaps、next probes | **已实验准入 local**；Agent 推断不能覆盖来源事实，真实 L3 质量未验证，小样本不声称总体频率 |
| `influence.read-owned-influence-snapshot` | owned content/release/campaign、window | 平台原生曝光/播放/访问/互动/转化指标与 limitations | 不把不同平台 metric 强行等价 | 候选 |
| `influence.attribute-outcome` | campaign/revision IDs、UTM/referrer/cohort window | source-native attribution observations、unattributed remainder | 只能报告可观测关联，不能自动宣称因果 | 候选 |
| `distribution.evaluate-impact-observation-set` | PublicationRevision/可选 Receipt + 去身份化 native baseline/current observations | 可比较 delta、pending/unknown/definition-drift、platform-attributed/temporal-association/unknown | **已实验准入 local**；不读平台、不变零、不跨平台打分、不建立因果；真实 owned analytics reader 仍独立 |

公共层不应该出现 `connector`、`collector`、OAuth route、供应商名、prompt 或内部 trace。平台差异由 Connector 映射，公共输出必须同时保留 `native state/metric` 和少量稳定投影。

## 3. 目标 A：需求发现

### 3.1 工作流

```text
明确决策
→ 把模糊问题编译成 source-specific query pack
→ 发现候选证据
→ 读取有界样本/增量
→ 去身份化与 provenance
→ 区分用户表述、我们的推断和反证
→ 生成可独立验证的 Opportunity
→ 用产品实验或第二来源证伪/确认
```

### 3.2 独立能力

| 能力 | 最擅长回答 | 来源路线 | 验证门 |
| --- | --- | --- | --- |
| Web SERP page | 用户如何表述问题、哪些社区/页面值得继续读 | DataForSEO / SerpApi / Bright Data | geo/locale/rank/observedAt、预算和结果不完整语义 |
| Search interest series | 相对关注随时间/地域怎样变化 | Google Trends API alpha | 正式资格；明确不是绝对搜索量 |
| Public app catalog search | 哪些 App 是目标问题、类别或竞品候选；当前版本/价格/评分摘要是什么 | Apple 文档化 Search API 已验证；Appfigures/42matters 商业备援待验证 | storefront/surface、小页、metadata-only；顺序/数量不冒充排名或市场规模 |
| Public app review snapshot | 竞品版本、功能、bug 和 feature request | Appfigures / AppTweak / AppFollow | territory/date/version coverage、author 删除、commercial-use license |
| Owned search query delta | 用户通过哪些 query 找到自有站点 | Google Search Console | verified property、top-row 截断、合法空集 |
| Public place review snapshot | 本地服务体验、流程摩擦和未满足需求 | Google Places 最多 5 条 candidate；DataForSEO newest-first 20 条 candidate | Google 原生评论只允许瞬时完整署名观察；DataForSEO 删除 reviewer 身份/历史/图片与 owner reply 原文，但 verbatim 仍只瞬时。两者 place resolution 均未确认、sample 不完整，不能推频率；供应商访问不证明 Google 授权 |
| Classified listing snapshot | 价格带、闲置原因、故障、缺件、兼容性与替代方案 | 闲鱼、58 分平台 Connector | 小样本、无卖家/精确地点/联系信息；平台授权 |
| Job posting snapshot | 企业愿意为哪些流程、技能和问题付费 | Coresignal multi-source candidate / Bright Data research；BOSS direct 需许可 | Coresignal 已有隐藏 candidate Connector：固定 active-only DSL、最多 10 条、credit 对账、去 recruiter/source route；Data agreement、中国/source coverage 与 live probe 尚未批准 |
| Public work-item delta | 可复现 bug、workaround 和维护者判断 | GitHub Issues/PR | checkpoint、编辑/关闭语义、repo scope |
| Frontier research delta | 形式化能力缺口、benchmark、方法与限制 | arXiv/OpenAlex/OpenReview | 版本/ID 去重、source claim 与 inference 分层 |

详细访问与付费路线见[需求信号访问路线调研](demand-signal-access-routes.md)。任何一个来源都不能单独证明市场规模；至少需要“真实问题证据 + 可验证方案/实验”，高风险结论再加第二类独立来源。

## 4. 目标 B：个人助理/宠物

### 4.1 完成一次任务需要的能力链

```text
resolve owner/channel
→ assemble bounded current context
→ retrieve relevant memory with provenance
→ ground memory into proposed action arguments
→ assess impact and request approval
→ execute exactly once or return unknown
→ reconcile receipt/result
→ update current projection and propose memory change
→ project truthful task state to pet behavior
```

### 4.2 可独立验证的能力

| 能力 | 独立性 | 最小验证 |
| --- | --- | --- |
| Owner-bound channel/session resolution | conditional：需要真实入口身份 | 同一 owner 跨 Web/手机/语音连续；不同 owner/channel fail closed；临时频道态不进入长期记忆 |
| Bounded current-context projection | independent；**读取窄闭环已准入** | 固定生产 PKB 已在隔离仓库真实组合 current、相关旧 Session 与匹配长期知识；opaque Session/Workspace、字符预算、关闭旧 Session、当前 Session 排除、逻辑来源、ephemeral/non-executing 均通过。维护 current、cursor、删除/重建与并发恢复仍是不同能力，不由本读取能力声称 |
| Current-work projection maintenance | independent；**维护窄闭环已实验准入** | owner-bound 当前 Session 未消费 events → 生产 maintainer → 原子 current write + cursor advance + 最多四个未确认 proposal；已验证无新事件重放不再次调用模型，proposal 不 apply、durable Markdown/Git 不变。真实 owner resolution 与模型质量仍未覆盖 |
| Current-work projection reconciliation | independent；**启动/离线增量恢复已实验准入** | owner-bound 当前 Session/Workspace → 最近最多 12 个持久 Session 的各自 cursor 后增量；固定生产 maintainer 已验证旧到新串行合并、重放无模型调用，以及第二个 Session 中断后保留第一个 Session 的 current/cursor 并只恢复剩余 Session。当前 Session 被排除，proposal 不 apply、durable Markdown/Git 不变；来源失败不能完整枚举，也不执行 cursor reset、current 删除或全量重建 |
| Memory proposal / conflict / forget | independent；**已准入 review preparation 窄闭环** | 单项 USER.md/knowledge/*.md upsert/delete 与 base/current/desired digest、完整 Markdown 和 provenance 绑定；已在隔离生产 PKB 跑通 proposal → confirm → atomic write → Git commit → receipt，并验证并发冲突。真实主人确认和生产 apply 仍不在公开能力内 |
| Memory-to-action grounding | independent；**已准入窄闭环** | field-addressed claim + 扁平 scalar action contract → Action Candidate；已测 exact scope、user-confirmed/tool-verified、过期、冲突、inferred、explicit-only、provenance 和 `executionAuthorized=false`。自然语言 claim 抽取、嵌套 Schema 与真实执行仍分开 |
| Versioned memory-use evaluation | independent；**已准入窄闭环** | 显式 supersession/revocation/contest/expiry/scope 图 + 标准化 observed trace → 五阶段评测；十类 fixture 已覆盖当前确认、显式覆盖、旧版本、冲突、缺失、相似干扰、scope 隔离、过期、撤销和争议。只评 trace，不运行 memory backend，不把 local score 冒充长期陪伴结果 |
| Action impact review revision | independent；**已准入窄闭环** | grounded candidate + 完整 scalar arguments + exact scope/targets + data/audience/cost/reversibility/consequence refs + expiry；已测 mutation invalidation、保守分级和 incomplete/effect declaration blockers，结果不含 decision/token/authorization |
| Impact-aware action approval | independent；**架构调研已通过，当前 DSH Web route 已被安全反证暂停** | 两次真实 `technical-solution` 运行先确定 exact review revision、可信交互、一次性 consume、执行与 receipt 的分层，再审计 DSH one-shot seam、固定 Web transport 源码和 self-approval/cross-session/late-cancellation 反例。seam 可作为未来内部原语；当前 Web answerer 缺 owner/channel attestation，不创建 Connector，不能由 caller supplied `approved=true`、可观察 RPC ID 或 review preparation 冒充 |
| Idempotent execution and receipt | conditional：依赖工具 route | 成功、明确失败、timeout/unknown、重复调用和恢复；unknown 禁止盲重发 |
| Proactive proposal policy | independent；**已准入 review-only 窄闭环** | owner opt-in/pause、IANA quiet windows、recent activity、min-gap、daily/unanswered caps、source-visible、dedupe、copy/surface/expiry → immutable review revision；suppressed 返回全部理由，结果不创建消息、不 delivery。真实 permission、主人决策、发送与 receipt 仍独立 |
| Full-duplex turn policy | independent；**normalized event policy 已准入** | 固定 trace 已证明候选降音、误触恢复、backchannel 不抢轮、确认 take-turn 后才 cancel/open、用户轮次提交和非法状态拒绝；能力不接收 raw audio。真实双通道音频分类、设备/语言/噪声覆盖与产品接线仍待独立验证 |
| Task-state → pet-behavior projection | independent；**已准入一个窄闭环** | 当前固定生产语义覆盖 running/idle baseline、waiting/review/failed 任务边沿和 Pet Assistant waiting/waving/jumping/review/failed pulse；local probe 已验证确定性、首次快照 priming 与私有字段拒绝。thinking/hold/idleFallback、角色 C0 和 UI/动画装配仍未准入 |
| Persona continuity evaluation | independent；**四轴待人审窄闭环已实验准入** | 冻结 persona revision 与七类情境；两个版本化 evaluator 分别返回 role/boundary/value/style 与独立 system truth，保留 unknown/disagreement、禁止总分。scripted evaluator 仅证明契约；真实 judge L3、重复率、trajectory memory 与长期结果仍独立 |
| Multi-turn response repetition observation | independent；**词法窄闭环已实验准入** | 同一 case 内按 locale 规范化并观测原样重复、2/3-gram 历史重叠；确认复述、纠错、安全边界与口头禅保留 provenance 但不删原始计数。无阈值、无质量分；语义重复、persona continuity 与长期结果仍独立 |
| Longitudinal companionship safety | not-independent | 必须做数周/月用户研究；不以时长、依赖或拟人化程度作为单一成功指标 |

现有[个人助理/宠物目标研究](personal-assistant-pet-goal.md)已经为 bounded current context、single-Session current maintenance、startup/offline reconciliation、memory-to-action、versioned memory-use evaluation、persona continuity evaluation、approval、全双工 turn policy 和宠物状态投影收集了生产实现、GitHub/arXiv 与官方 runtime 证据。读取、维护、增量恢复、memory trace 评测与 persona 四轴评测保持独立；增量恢复不冒充 current 全量重建，Persona 也只通过 scripted evaluator 契约 probe，不冒充真实 judge 或长期陪伴。下一步不是再搜更多“AI assistant”项目，也不是直接复用当前 DSH Web approval。等待或实现 owner-bound answerer 后，先在真实 Client/Host sandbox 证明 Session-scoped delivery、回答者认证、nonce、撤销与 exact revision，再冻结一次性 consume；在此之前不创建可路由 OKF approval 能力。全双工侧若要声称真实语音可用，必须补音频分类和实际播放控制组合 probe；Persona 侧下一步是独立的真实 Agent L3 校准，而不是增加总分。

## 5. 目标 C：游戏发布与分发

### 5.1 发布链

```text
owned game revision
→ platform-specific metadata/build preflight
→ upload/submit
→ processing + review state
→ explicit release handoff
→ store visibility receipt
→ traffic/wishlist/download/purchase observation
→ review/community/crash feedback
→ update revision
```

### 5.2 独立能力

| 能力 | 平台差异必须保留 | 最小 probe |
| --- | --- | --- |
| `game.prepare-local-build-revision` | **已准入** desktop/Steam content root/itch portable/Web 的本地文件集；不覆盖 store assets、rating/content declarations、localization | fixture 已验证真实逐文件摘要、稳定 revision、byte mutation、symlink/密钥/入口点阻断和 non-upload 边界 |
| `steam.prepare-store-asset-review-revision` | **已准入** Steam 专属四种 base capsule 与 screenshot；不覆盖文案、Library/Community/Event、trailer、分级和 localization | 九个真实 PNG fixture 已验证当前尺寸、五截图下限、摘要、稳定 revision、旧尺寸/缺失/symlink 阻断；六项视觉/权利检查固定 pending，non-upload/non-review |
| `steam.prepare-store-description-review-revision` | **已准入** Steam English fallback 与当前 full-platform language code 下的 plain-text short description / About This Game；不覆盖系统要求、标签、分级、Early Access、图片或其它商店 | 英中 owned-copy fixture 已验证稳定 hash、文案/翻译/功能依据 mutation、fallback/language/link/markup/budget blockers；七项语义审阅固定 pending，non-upload/non-publish |
| `steam.prepare-store-tag-review-revision` | **已准入** Steam 有序 5–20 Tag、逐项首发证据、目录 revision 与 audience evidence；不覆盖 Tag Wizard 实际保存、系统要求、分级或其它商店 | owned-game fixture 已验证顺序/身份/名称/证据/目录 mutation binding、数量和重复 blockers；平台有效性、top-five 清晰度、相关性、排序与 build 一致性固定 pending，non-save/non-publish |
| `steam.prepare-content-survey-review-revision` | **已准入** Steam General/Mature/Generative AI 三部分，绑定调用者观察到的 questionnaire revision、完整问题集合、逐题答案/内容/证据、成人内容和 build/store 声明及 AI evidence；不复制动态题库 | owned-game fixture 已验证稳定 hash、问卷/build/答案/证据/声明/AI mutation binding；缺题/部分/声明、AI mode 冲突及 live AI 无 guardrail 阻断，真实映射/答案/权利/分级固定 pending，non-submit/non-rating/non-visibility-change |
| `steam.prepare-early-access-review-revision` | **已准入** 六项公开 Early Access Q&A、当前 build/预告片/功能/限制、开发/资金/未来承诺/社区影响、价格与第三方 key 站点披露；不覆盖 checkbox、日期控件或平台保存 | owned-game fixture 已验证稳定 hash 和全部 mutation binding；漏答、不可玩/未知、已完成、销量依赖、未来保证、无社区影响、价格/披露冲突阻断。官方同页 1.0 日期字段说明冲突，能力不暴露该字段；真实价值/文案/平台字段固定 pending，non-save/non-review/non-release |
| `steam.prepare-initial-base-price-review-revision` | **已准入** 未发布标准基础包的 37 个 live currencies + `USD_CIS/LATAM/MENA/SASIA` 四组首次基础价格，绑定 currency catalog、调用方观察最低阈值、build/package、market/value evidence 与审核后发布模式；不覆盖折扣、后续调价、DLC/bundle/订阅/微交易 | 41-market fixture 已验证稳定 hash、完整覆盖、当前公开 minor-unit increment、观察最低值、首次状态和全部 mutation binding；后台 catalog/minimum、收款 Partner、权限、价格价值与 preview 固定 pending，non-CSV/non-submit/non-approve/non-publish |
| `steam.prepare-initial-release-date-review-revision` | **已准入** 初始上线的精确后台日期、玩家侧 exact/month/quarter/year/Coming Soon 显示、store/build revision、调用方观察状态与决策证据 | owned-game fixture 已验证五种显示范围与 Upcoming 排位、Coming Soon 14 天、两周精确日期锁定、24 小时观察新鲜度及 store/build Ready blocker；状态不认证，权限与运营检查 pending，non-save/non-coming-soon-change/non-release/non-wishlist-notification |
| `steam.prepare-supported-feature-review-revision` | **已准入** Steam Basic Info 拟选择的 supported features，逐项绑定当前 build 的实现与测试证据及观察到的目录 revision；不覆盖目录读取、后台保存、分级或 Early Access | 五项 owned-game fixture 已验证稳定 hash、build/catalog/名称/实现/测试证据 mutation binding；planned、unknown 和重复声明阻断，真实目录/证据/功能可用性固定 pending，non-save/non-review/non-release |
| `steam.prepare-system-requirements-review-revision` | **已准入** Steam Windows/macOS/Linux/SteamOS 原生字段，逐平台绑定 build artifact、depot、public package、launch tests 与逐字段 evidence；不覆盖后台 checkbox/default branch | 三平台 fixture 已验证排序归一、所有绑定 mutation、最低/推荐完整性和非 Windows DirectX blocker；配置真实性与平台一致性固定 pending，non-save/non-preview/non-publish |
| `game.prepare-store-metadata-revision` | 其它商店，或 Steam 剩余 listing/价格生命周期字段 | 仍候选；Steam initial base price 与 initial release date 已独立准入，Launch Discount、后续调价和 Early Access 1.0 日期继续留在对应生命周期；其余按真实目标商店和字段族逐个建立 fixture，不能把 Steam 文案、Tag、Content Survey、Early Access、price、release date、supported feature、system requirements 或 asset schema 扩成假统一 schema |
| `game.upload-build` | Steam depot/branch、itch channel、mobile bundle、console package | 私密/测试目标；固定 digest；上传 receipt；timeout 后按 remote state 对账 |
| `game.submit-store-review` | review scope、审核阶段、费用/协议、内容分级 | sandbox/测试 app；只提交 approved revision；保存 native submission ID |
| `game.read-release-state` | processing/review/approved/rejected/ready/released 的平台原生语义 | 只读自有测试产品；验证 transition、blocking reason、更新时间和合法空集 |
| `game.release-approved-revision` | Steam/Epic/console 的最终发布 handoff；itch build 可能立即 live | 必须最终人工确认；重新发现 store page/build/version，形成 PublicationReceipt |
| `game.read-store-traffic` | impressions、visits、UTM、wishlist、download/purchase 的定义与可用性 | 自有 app、固定窗口；保留 native metrics、成熟期、阈值/抑制、未归因与缺失值，不跨平台伪等价；首个 `distribution-impact` 调研已选 effect-free observation evaluator 先行，真实读取仍等 owned identity |
| `distribution.evaluate-impact-observation-set` | **已准入** Steam/Apple/Google Play 原生 count observation 的定义、scope、窗口、成熟度和归因边界；不读取账号或导出 | 六组 fixture 已验证 suppression≠0、not-finalized→pending、definition drift、scope mutation、receipt-bound attribution、temporal-only 非因果与跨平台拒绝 |
| `game.read-public-review-page` | cursor、排序、语言、推荐/星级、游玩时长 | **Steam 已通过 live probe**；其它平台分别验证 |
| `game.read-owned-player-feedback-delta` | review/reply、测试反馈、discussion/community、edit/delete | 自有游戏/测试 channel；checkpoint、去身份化、回复状态和 mutation reconcile |
| `game.read-crash-quality-delta` | crash、ANR、平台兼容、版本/硬件聚合 | 只保留粗设备/版本 cohort；不收集玩家指纹；与 store review 分开 |
| `game.publish-update-note` | store announcement、社区 post、社交内容 | 由一次 immutable content revision 派生平台变体；每个平台各自 receipt |

### 5.3 路线排序

- **Steam**：公开评论页、本地 store asset、text-only description、有序 Tag、Content Survey、Early Access、initial base price、initial release date、supported features 和逐 OS system requirements revision 已准入；下一步只在有 Partner appID 后读取自有 review/release/traffic state。首次定价不认证后台 catalog/minimum/权限，日期能力也不认证调用方状态；CSV、价格提交/审核/发布、折扣、后台保存/预览、Coming Soon 变更、问卷/答卷提交、上传、Mark as ready for review 与正式 Release 继续独立授权和人工确认。
- **itch.io**：butler 的 channel/build 模型适合验证不可变 build 上传，但新 build 可能立即 live；必须使用私密测试页并把上传和公开发布分开。
- **TapTap**：中国玩家发现、测试和评论价值高；先区分自有开发者数据与公开社区数据，完成协议/账号 probe 后再建 Connector。
- **Epic**：PC 目标明确后研究自助提交与 release-state；当前没有目标游戏和组织身份，不占 active slot。
- **App Store / Google Play**：游戏仍复用 App 发布/评论能力，但商店审核、测试 track、崩溃质量和评论是不同切片。
- **主机平台**：只有获批 developer identity、硬件与真实发行计划后逐平台研究，不建立“统一主机发布”空壳。

## 6. 目标 D：反馈闭环

### 6.1 “收集反馈”至少是十三件事

| 能力 | 结果 | 关键边界 |
| --- | --- | --- |
| Define feedback scope | target、decision、window、sources、PII/retention policy | 没有决策问题时不无限采集 |
| Prepare consented intake revision | 自有 form/support/interview/study submission 与 purpose/notice/consent/privacy/retention/withdrawal 待审 revision | **本地 effect-free 能力已准入**；不自动检测 PII、不认证合法性、不存储或签发 receipt；撤回/过期 consent、越界用途、字段漂移与隐私未解决会阻断 |
| Persist reviewed intake + receipt | 准确 intake revision + owner-controlled store + trusted review grant → private record 与幂等 storage receipt | **本地 `local-write` 能力已实验准入**；真实写入/同步/并发/冲突/篡改/清理已验证，但生产人审授权签发器未接；不执行撤回、删除或回复 |
| Withdraw stored intake + receipt | storage receipt + record digest + withdrawal request/mechanism + trusted withdrawal grant → logical deletion 与幂等 withdrawal receipt | **本地 `local-write` 能力已实验准入**；真实删除、并发、unlink 前后中断恢复和篡改拒绝已验证；不声称介质擦除、备份/下游副本删除，到期清理仍独立 |
| Expire retained intake + receipt | storage receipt + record digest + 原始 policy/deadline + trusted retention grant + clear hold → logical deletion 与幂等 retention deletion receipt | **本地 `local-write` 能力已实验准入**；隐藏 Collector 对 due 项只提案，Connector 才执行；固定未来时钟 probe 已验证真实删除、并发与恢复，生产 scheduler/grant/hold 未接，不声称介质、备份或下游副本清除 |
| Ingest owned review delta | 自有 App/store/content 新评论与回复状态 | 官方账号 route；作者去除；checkpoint |
| Read public competitor snapshot | 竞品公开评论/帖子小样本 | 明确不完整；不建立用户图谱 |
| Ingest support/community delta | 自有 email/form/Discord/Slack/support ticket | 私有反馈，授权和保留期高于公开研究要求 |
| Ingest product-quality signals | crash/ANR、失败 receipt、性能和版本 cohort | 遥测不是用户意图；粗粒度设备/版本，避免指纹 |
| Reconcile mutations | edited/deleted/hidden/replied/duplicated feedback | **本地对账已准入**；Steam 已有首个 partial window 适配，缺失仍不自动等于删除，平台读取须保留 source-native state 与窗口证据 |
| Normalize evidence | source item、target revision、time、locale、rating/severity、digest | 平台原文不强制统一；identity 字段在 Connector 删除 |
| Synthesize themes/opportunities | recurring pain、request、workaround、affected workflow、counterexample | **主题证据契约已实验准入**；frequency 只是样本线索，Agent 推断只回链 evidence refs，真实 L3 尚未通过 |
| Close the loop | owner、decision、reply/fix revision、release receipt、after-window outcome | 自动回复/承诺/issue 创建是独立写操作；修复后再测是否改善 |

### 6.2 反馈来源角色

| 来源 | 最擅长证明 | 不能单独证明 |
| --- | --- | --- |
| Store/content comments | 用户语言、情境、情绪、版本线索 | 总体发生率、技术根因 |
| Support tickets/forms/interviews | 具体工作流、后果、期望结果 | 无偏市场分布 |
| Search queries | 用户主动寻找什么 | 是否最终解决、为何放弃 |
| Crash/telemetry | 失败发生率、版本/环境关联 | 用户感受与需求 |
| Public competitor reviews | 替代品的摩擦和机会 | 我们产品用户一定相同 |
| GitHub issues | 技术复现、workaround、维护判断 | 普通消费者需求和市场规模 |
| Revenue/conversion/retention | 行为结果变化 | 单独的因果解释 |

反馈闭环的稳定公开对象应是 `ConsentedFeedbackIntakeReviewRevision`、`FeedbackIntakeStorageReceipt`、`FeedbackIntakeWithdrawalReceipt`、`FeedbackIntakeRetentionDeletionReceipt`、带持久化 receipt 的 `FeedbackObservation/Delta`、`FeedbackThemeEvidence` 和 `FeedbackOutcomeReview`，不是一个跨平台的“评论表”。Intake revision 不能冒充已收集事实；storage receipt 不能冒充撤回；withdrawal 与 retention deletion receipt 只能证明各自原因下的逻辑删除，不能冒充介质、备份或下游副本清除。回复、创建 issue、修改 roadmap 或发布修复仍是独立显式动作。

## 7. 依赖与执行顺序

```text
Evidence route + query scope
        ↓
bounded source snapshot/delta
        ↓
provenance + deidentification + mutation semantics
        ↓
research synthesis
        ↓
independent Opportunity + product probe
        ↓
immutable publication revision
        ↓
submission/release receipt
        ↓
feedback + influence delta
        └───────────────→ next research decision
```

当前领取顺序：

1. 保持小红书发布/反馈为唯一 active build，不绕过用户确认和真实身份门；
2. 个人助理的 bounded current-context read、single-Session current maintenance、最近持久 Session 的 startup/offline reconciliation、versioned memory-use evaluation、pet public-state projection、memory-to-action grounding、impact review 和 effect-free full-duplex normalized-event policy 已完成冻结 local eval；读取、维护、增量恢复和 trace 评测保持分离。恢复 probe 已覆盖两个 Session、精确重放和中断后续跑，但只枚举最近 12 个且来源失败不完全可观察，不能冒充全量重建、cursor 修复或真实 backend owner binding。两次真实技术调研已选择 impact-aware approval 并拒绝当前 DSH Web answerer 路线。等待 owner-bound transport 修复与真实 sandbox 负向验证期间，只能继续推进音频分类/播放控制组合 probe；不能把 caller 参数、Agent 输出、可观察 RPC ID 或 review revision 冒充用户授权与执行；
3. 需求信号已形成 25 条隐藏 access route 与 26-source 通用零费用 Maintainer；Apple public app search 已 live 准入并成为唯一自动可选 route。DataForSEO SERP、Google Places public review、DataForSEO Google Reviews、Appfigures public review 和 Coresignal Jobs 五个 candidate/Collector/probe pack 已完成，分别取得 provider 身份、用途/双方条款和小额费用批准后验证；Google Places 还必须先有合规的瞬时作者署名/Google Maps attribution 界面且不得持久化 Places 内容，DataForSEO 深样本则必须删除 reviewer 身份并保持 verbatim 瞬时。Google Custom Search migration-only、Apple 未文档化 review RSS、Google Play direct public route、闲鱼会话 Actor、58 商业抓取和 BOSS direct scraper 继续 suspended；
4. 闲鱼只做最多 20 条的可见浏览器 probe；58/BOSS 在授权询证前不执行；
5. 游戏本地 build 与 Steam asset/description/tag/content-survey/early-access/initial-base-price/initial-release-date/supported-feature/system-requirements revision 已完成 effect-free 验证；传播影响 observation evaluator 也已准入，但不读取平台。首次基础价格覆盖完整 41-market observation，但真实 catalog/minimum/权限、Launch Discount、后续调价、后台保存、上传、审核、release-state 和 owned analytics reader 继续等待真实 target game 与自有 developer identity；
6. 经同意的自有反馈 intake review revision、本地持久化 receipt、receipt-bound 用户撤回、policy/deadline/hold-bound 到期逻辑清理、observation reconciliation、Steam partial observation adapter 与 distribution impact evaluator 已完成相互独立的本地组合原语；下一步是接入真实 owner-bound review/withdrawal/retention grant、hold resolver 和 scheduler，拆出 backup/index/downstream deletion，或在第一条自有发布 receipt 与 source-native analytics observation 出现后组合真实 after-window。不能把 scripted grant、Collector proposal、固定未来时钟、逻辑 unlink、本地 revision、分页 cursor、缺失值或时间相邻冒充生产授权、生产调度、安全擦除、checkpoint、零值或因果。

### 7.1 本轮四目标验收

| 目标 | 已形成的可验证闭环 | 尚不能声称完成 | 下一次解锁条件 |
| --- | --- | --- | --- |
| 需求调研 | 证据化调研契约及 9 次真实 Agent 场景运行（3 次 `platform-integration`、2 次 `technical-solution`，其余四类各 1 次）；GitHub/Steam/arXiv live 数据面；Apple 公开应用搜索；需求信号 route 与 Maintainer | Google Web/Google Play/公开竞品评论/闲鱼/58/BOSS 的真实结果能力；跨 runtime 重复性 | provider 身份、用途/条款确认与最小付费 probe；闲鱼可见浏览器 probe 的人工批准 |
| 个人助理/宠物 | opaque owner context → single-Session current maintenance / 最近持久 Session startup-offline reconciliation → bounded ephemeral read；versioned memory trace → 五阶段 eval；frozen persona revision/七类情境 → 四轴、多 evaluator、system-truth 分离 eval；有界多轮回复 → 原样重复与 2/3-gram 历史重叠；public state → pet behavior；authoritative memory → Action Candidate → impact review；normalized duplex event → reversible turn actions | 真实 memory backend owner binding、最近 12 个以外的枚举完整性、来源失败完整可观察、current 删除/全量重建、cursor 丢失/损坏修复、多进程并发、可信交互审批、一次性授权消费、claim extraction、真实音频分类与播放接线、persona judge L3/多语言校准、语义重复、trajectory recall 与长期陪伴效果；当前 DSH Web answerer 已因 self/cross-session approval 反例暂停 | owner-bound answerer 修复后验证可信审批；current 恢复侧需先设计显式全量重建/cursor repair 事务与安全检查；Persona 侧运行真实 Agent evaluator 的 blind fixture、反例与跨语言一致性；重复侧另行研究语义 evaluator，不得与 trajectory memory 或陪伴结果混分 |
| 游戏发布 | 本地 build revision；Steam store asset/description/tag/content-survey/early-access/initial-base-price/initial-release-date/supported-feature/system-requirements revision；Steam public review page；native impact observation evaluator | 真实定价目录/最低阈值与权限、Launch Discount/后续调价、后台保存/Coming Soon 变更、上传、审核、release receipt、自有流量/愿望单读取 | 平台读写仍需明确目标游戏、owned developer identity 与私密测试目标；价格/日期 revision 与 evaluator 通过都不能冒充平台状态已认证、已保存或数据已获取 |
| 反馈收集 | consented owned-feedback submission → effect-free intake review revision → trusted-grant local storage receipt → receipt-bound logical withdrawal receipt / policy-deadline-hold-bound retention deletion receipt；observation reconciliation；theme evidence；Steam page → partial observation window；source-native impact delta/attribution evaluation | 生产 review/withdrawal/retention grant、hold resolver、scheduler、backup/index/downstream deletion、完整 feedback delta、reply/tombstone、真实 owned influence snapshot、close-loop 写操作 | owner-bound 授权与 hold/scheduler 集成，或第一条 owned publication receipt 与 complete/finalized 平台 observation，或具备 tombstone/checkpoint 语义的平台 feedback route |

因此当前不是“四个产品目标都完成”，而是共享抽象和可独立验证的低副作用底座已经落地。任何下一步跨平台 live 能力都需要新的身份、费用、条款或真实 owned target；在这些条件出现前，继续堆候选不会提高可用闭环数量。

## 8. 准入与停止条件

一个 Capability 只有同时满足以下条件才进入 canonical `knowledge/`：

- 直接推动上面某个 workflow 的可观察结果；
- 输入、输出、失败、checkpoint、副作用和数据边界可写成 Schema；
- Connector 非空且 conformance verified；
- live/sandbox probe 真执行并有未过期报告；
- Collector 能观察官方规则、route upstream、verification freshness 和高信号故障；
- 外部调用者无需知道 Connector、Collector、身份、供应商或内部 route。

若一次性 Web/模型搜索已经足够、来源不改变决策、只有技术可达而没有授权、或结果必须依赖长期心理/市场网络效应才能证明，则停止建设：前两者只作为隐藏 Collector 手段，后两者保留 research proposal。

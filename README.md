# Knowledge

一个普通、独立的 Git repository，不是插件。它从产品目标出发，服务一个明确闭环：

```text
发现需求 → 研究产品、渠道与前沿技术 → 制作/发布内容、App 或研究成果 → 分发增长 → 收集反馈 → 复盘影响力
```

```text
knowledge/   外部可感知的 OKF 知识与可调用能力
connectors/  隐藏的执行逻辑
collectors/  隐藏的发现、检查、维护和 proposal 逻辑
probes/      可重复验证定义与无秘密控制面
```

外部只消费 `knowledge/`。Connector、Collector、身份、凭据、内部 route 和 trace 不进入公共知识面。

## 价值边界

真实 probe 是准入必要条件，但不是价值证明。Subject 或 Capability 还必须直接服务至少一个结果域：

- 需求发现与用户反馈；
- 产品、竞品、论文、模型、数据集与评测研究；
- 自媒体内容制作、发布与账号运营；
- 渠道分发、增长与影响力测量；
- App Store、Google Play 等应用发布与评论反馈。
- 论文、预印本、数据集和研究制品的受控提交、发布与引用追踪。

模型本来就会使用、且只作为内部维护手段的通用开发基础设施，不因“能做 live probe”进入 OKF。需要时由隐藏 Collector 直接消费。

## 准入闭环

```text
outcome-aligned Subject
+ Capability 与产品 Schema
+ hidden Connector
+ repeatable live/sandbox Probe
+ passed, unexpired VerificationReport
```

缺少任意一项就留在 `.staging/`。真实用户名、邮箱、Cookie、token、密钥和运营身份清单永远不进 Git。

## 当前状态

```text
OKF 文档：147
已准入 Subject：42
已准入 Capability：46
Connector：44 个 verified，8 个 candidate（含 mixed 的 xiaohongshu-browser 顶层状态）
维护 Collector：55
```

当前保留：

- 小红书：官方接口面、社区规则和本人笔记读取；发布闭环仍未验证。
- 抖音：官方开放平台能力面和公开视频描述；搜索、反馈与写操作仍未验证。
- TikTok：已验证官方无账号 oEmbed 对明确公开视频 URL 的最小描述；它不是搜索。Research API 因 commercial eligibility 暂停，自有 Display API、Content Posting API 和 OOMOL 公共研究路线分别保持 researching。
- YouTube：官方 Data API 的 video-only 关键词搜索 Connector candidate 已实现；固定单页最多 10 条、无频道身份/近似总数/分页、30 天刷新或删除。Google Cloud project、受限 API key 和 live quota probe 未批准，因此尚未准入 OKF。
- GitHub：作为需求、生态和上游变化 Collector 的数据面，覆盖搜索、文件、tag、release 和 issue/PR 增量。
- Hugging Face：仅作为前沿模型、数据集和评测研究的证据底座；当前只验证了精确模型 revision 清单。
- arXiv：已验证官方 Metadata API 的纯 phrase/category 小页检索，遵守三秒/单连接限制；只保留描述性元数据，不下载论文内容，offset 不作为 delta checkpoint。
- Apple App Store：已验证文档化 Search API 的无账号小页检索；按 storefront/surface 返回最小应用元数据，明确不提供榜单、完整语料、历史或排名语义。官方文档已归档，因此七天复验并保持 experimental。
- 证据化调研：本地实验能力，统一六类研究场景的公共 Research Dossier；六类均已有真实 Agent 样本。首个市场/竞品样本用 Apple 公开目录、固定 GitHub 实现、独立长程 benchmark 与本地边界裁决个人助理/宠物下一切片，拒绝从目录顺序/评分推市场规模，也拒绝 companion quality 总分；跨 runtime 重复性仍待验证。
- 传播影响评测：已准入 effect-free 的 source-native observation evaluator；只对同平台/数据源/指标定义/scope/unit、等长完整且最终化的窗口计算 delta。阈值抑制、不完整、未最终化、定义漂移和 Not attributed 保持未知或 pending；平台归因、时间关联与因果严格分离。平台自有数据读取仍未准入。
- 个人助理/宠物：已准入相互分离的有界工作上下文读取、single-Session current 维护、最近持久 Session 的 startup/offline 增量对账、版本化记忆使用评测、experimental Persona 连续性评测、多轮助手回复词法重复观测与公开状态到宠物行为投影。对账真实验证逐 Session cursor、精确重放和中途失败续跑，但固定声明最近 12 个上限、来源失败不可完整观察、非全量重建且不重置 cursor。Persona 评测冻结 revision 与七类情境，分别保留 role/boundary/value/style、系统事实、unknown 和 evaluator disagreement；没有 companion-quality 总分，scripted probe 不冒充真实模型判断或长期陪伴结果。重复观测仅保留原样重复、2/3-gram 历史重叠及调用方语境证据，不设阈值、不生成质量分，也不推断语义重复或长期陪伴结果。记忆评测以摘要和显式 supersession/revocation/contest/expiry/scope 派生真值，分别报告 ingestion、retrieval、版本解析、abstention/action decision 与 utilization；这些能力都不暴露内部 route。
- 记忆到动作：已准入 field-addressed claim 到 Action Candidate 的确定性绑定；保留 provenance、冲突和过期原因，永远不把参数准备冒充执行授权。
- 动作影响审阅：已准入 grounded Action Candidate 到 exact action/arguments/scope/targets/impact/expiry review revision 的确定性绑定；保守分级并保留 pending 人审，不接受 reviewer decision、不签发 token、不授权执行。
- Google Web 搜索：DataForSEO 单页 SERP candidate、零费用 Collector 与 sandbox/live probe pack 已实现；账号、条款、credential、identity 和最高 `$0.01` live probe 未获批准，所以尚未准入能力。
- Google Places 评论：官方最多 5 条 relevance sample 的 candidate 已实现；只允许瞬时、完整作者署名和可点回 Google Maps 的观察，Git probe 不留地点/评论/作者内容。Google Cloud/billing、受限 API key、Terms/Privacy/归因界面、identity 和最高 `$0.03` live probe 未获批准，所以尚未准入能力。
- Google 评论深样本：DataForSEO 的独立 candidate 已实现；固定一次 standard queue task、20 条 newest-first、最高 `$0.002`，使用 suspend/resume executor 避免重复付费。输出删除 reviewer 身份/历史/图片、provider ID 与 owner reply 原文，评论原文只瞬时处理。供应商账号/条款/API credential、Google 内容使用与数据保护判断、sandbox 及 live probe 均未批准，付费 API 不被表述为 Google 授权。
- 公开 App 评论：Appfigures Apple/Google Play candidate、零费用 Collector 与两阶段 credit-ledger probe 已实现；内部用途/商业许可、PAT、Public Data credits、identity 和最高 5 credits/`$1` 未获批准，所以尚未准入能力。
- 需求信号访问路线：已结构化 27 条内部 verified/candidate/research/suspended route；通用零费用 Maintainer 观察 26 个价格、官方接口与政策面，Google Places、DataForSEO Google Reviews 与 OpenConnector 各有专职 Collector。Apple Search API 是当前唯一自动可选路线。OpenConnector self-hosted + TikHub 仅是公开社交搜索 component candidate，OOMOL 托管 Skill 仅是 research route；两者都未获账号/条款/用途/费用/live probe 批准，不进入 OKF。Google Custom Search 已关闭新客户并计划退役；闲鱼、58 与 BOSS 的未授权自动路线保持暂停。
- Steam：已验证公开游戏评论有界读取、评论页到 partial 反馈观察窗口的本地投影，以及相互独立的商店图像、本地化纯文本描述、有序 Tag、Content Survey、Early Access、初始上线日期、当前 build 支持功能和逐 OS 系统要求待审 revision；Partner 上传、后台保存、问卷/答卷提交、送审、Release App、流量、愿望单读取和开发者回复仍未接入。
- 游戏发布准备：已验证通用本地构建 revision；Steam store asset revision 覆盖四种 base capsule 与至少五张截图，description revision 覆盖 English fallback 与纯文本/链接边界，Content Survey revision 绑定观察到的问卷版本、三类完整答卷、成人内容声明和 pre/live-generated AI 证据，Early Access revision 绑定六项 Q&A、可玩 build、非销量依赖、非绑定未来计划、价格和第三方 key 站点披露，initial base-price revision 冻结 37 个 live currencies 与四个 USD region groups 的完整首次基础价格、调用方观察最低阈值和商业证据，initial release-date revision 同时冻结精确后台日期与五种玩家显示精度，并检查 Coming Soon 14 天、两周日期锁定及 store/build 审核状态，supported-feature revision 把当前 build、目录 revision、逐功能实现和测试证据绑定并阻断 planned/unknown 声明，system requirements revision 绑定各 OS 的 build/depot/package/启动测试与配置证据；都不把调用方状态、本地预检冒充后台保存、价格有效、分级签发、地区可见性、Valve 审核或发布。
- 反馈接收：已把“准备”“持久化”“用户撤回”“到期清理”拆成四项能力。到期清理重新核对 storage receipt、原始 policy/deadline 和当前时间，只在可信策略 grant 返回 `disposition=delete`、`holdStatus=clear` 后执行；隐藏 Collector 只生成 due proposal，不自动删。真实写入/删除、提前拒绝、并发、中断恢复、冲突、篡改和清理均已验证；到期 probe 使用固定未来时钟但真实文件系统效果。生产授权/hold/scheduler 未接，所有删除回执均不声称介质、备份或下游副本清除、法律合规或平台回复。
- 反馈对账：已验证两次去身份化观察之间的新增、编辑、回复与显式生命周期变化；缺失固定为 unresolved，不从分页/窗口缺失推断删除，checkpoint 只生成推进建议。
- 反馈主题证据：已验证 bounded evidence、支持/反例引用、冲突、未分配项、样本内计数和人审/非执行契约；真实 Agent L3 质量尚未验证，保持 experimental。

已移除 npm、PyPI、Go Module、crates.io、Maven Central、NuGet.org、Docker Hub、OSV 和以 Node.js Release Feed 为唯一来源的 Web Feed 闭环。它们可验证，但不直接推进本仓库的产品与影响力目标。

## 下一优先级

平台不再拥有顶层优先级。当前首个 active research goal 是“个人助理/宠物”：从用户工作流出发，用 GitHub、arXiv、Apple 公开应用检索及后续评论/社区证据持续发现可独立实现和验证的难点。当前 active build 仍是小红书私密发布、平台侧对账和持续反馈；闲鱼公开市场信号保留另一个 research 槽位。App Store 搜索已作为来源原语准入，下一步仍应由具体 research goal 决定 query，而不是扩大成应用商店百科。

完整的 P0/P1/P2、Watch、Reject 和最小 Schema 见 [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)。候选组合现在明确覆盖社交传播、游戏分发，以及 arXiv、OpenAlex、OpenReview、Zenodo 等前沿研究发现与成果发布渠道；它们仍按结果切片激活，不按平台名批量接入。同一时刻只实施一个切片，避免再次积累一批只有文档、没有闭环的“接入”。

四个当前产品目标及其共享依赖已经拆成[产品目标与独立能力地图](docs/research/product-goal-capability-map.md)。Google、闲鱼、58 同城、BOSS 直聘、App 评论和付费数据服务的访问、授权、价格与最小 probe 见[需求信号访问路线调研](docs/research/demand-signal-access-routes.md)。这两份都是研究队列，不是已接入能力；只有真实 probe 通过的单个切片才会进入 `knowledge/`。

## 文档

- [产品范围与价值门](docs/PRODUCT_SCOPE.md)
- [目标驱动的研究闭环](docs/GOAL_DRIVEN_RESEARCH.md)
- [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)
- [个人助理/宠物目标研究](docs/research/personal-assistant-pet-goal.md)
- [Memory-to-action grounding 调研](docs/research/memory-to-action-grounding.md)
- [产品目标与独立能力地图](docs/research/product-goal-capability-map.md)
- [需求信号访问路线调研](docs/research/demand-signal-access-routes.md)
- [OpenConnector：借执行架构，不借目录真相](docs/research/openconnector-upstream.md)
- [YouTube / TikTok 接入裁决](docs/research/youtube-tiktok-integration.md)
- [社交传播与游戏分发候选调研](docs/research/social-and-game-distribution.md)
- [游戏构建 Revision 与发布前预检调研](docs/research/game-build-revision-preflight.md)
- [反馈观察对账调研](docs/research/feedback-observation-reconciliation.md)
- [前沿研究发现与研究成果发布候选调研](docs/research/scholarly-information-and-research-publishing.md)
- [闲鱼公开市场信号接入调研](docs/research/xianyu-market-signals.md)
- [小红书接入调研](docs/research/xiaohongshu-integration.md)
- [GitHub Work Item 变更调研](docs/research/github-public-work-item-changes.md)
- [准入流程](docs/ADMISSION_WORKFLOW.md)
- [安全与身份](docs/SECURITY_AND_IDENTITIES.md)
- [架构](docs/ARCHITECTURE.md)

## 验证

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm install
npm run check
```

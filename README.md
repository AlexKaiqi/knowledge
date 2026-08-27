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
完整可用闭环：11（Information Source 3；Platform 8）
已准入 Subject：7
已准入 Capability：11
Connector：10 个已验证；xiaohongshu-browser 为 mixed（读取已验证、发布候选）
维护 Collector：12
```

当前保留：

- 小红书：官方接口面、社区规则和本人笔记读取；发布闭环仍未验证。
- 抖音：官方开放平台能力面和公开视频描述；搜索、反馈与写操作仍未验证。
- GitHub：作为需求、生态和上游变化 Collector 的数据面，覆盖搜索、文件、tag、release 和 issue/PR 增量。
- Hugging Face：仅作为前沿模型、数据集和评测研究的证据底座；当前只验证了精确模型 revision 清单。

已移除 npm、PyPI、Go Module、crates.io、Maven Central、NuGet.org、Docker Hub、OSV 和以 Node.js Release Feed 为唯一来源的 Web Feed 闭环。它们可验证，但不直接推进本仓库的产品与影响力目标。

## 下一优先级

平台不再拥有顶层优先级。当前首个 active research goal 是“个人助理/宠物”：从用户工作流出发，用 GitHub、arXiv 及后续应用评论/社区证据持续发现可独立实现和验证的难点。当前 active build 仍是小红书私密发布、平台侧对账和持续反馈；闲鱼公开市场信号保留另一个 research 槽位，App Store 公开检索退回候选队列，等待具体 goal/query 激活。

完整的 P0/P1/P2、Watch、Reject 和最小 Schema 见 [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)。候选组合现在明确覆盖社交传播、游戏分发，以及 arXiv、OpenAlex、OpenReview、Zenodo 等前沿研究发现与成果发布渠道；它们仍按结果切片激活，不按平台名批量接入。同一时刻只实施一个切片，避免再次积累一批只有文档、没有闭环的“接入”。

## 文档

- [产品范围与价值门](docs/PRODUCT_SCOPE.md)
- [目标驱动的研究闭环](docs/GOAL_DRIVEN_RESEARCH.md)
- [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)
- [个人助理/宠物目标研究](docs/research/personal-assistant-pet-goal.md)
- [社交传播与游戏分发候选调研](docs/research/social-and-game-distribution.md)
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

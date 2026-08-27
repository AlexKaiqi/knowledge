# Knowledge

一个普通、独立的 Git repository，不是插件。它服务一个明确闭环：

```text
发现需求 → 研究产品与渠道 → 制作/发布内容或 App → 分发增长 → 收集反馈 → 复盘影响力
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
- 产品、竞品、模型、数据集与评测研究；
- 自媒体内容制作、发布与账号运营；
- 渠道分发、增长与影响力测量；
- App Store、Google Play 等应用发布与评论反馈。

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

候选不再按“平台是否有 API”排列，而按可验证的结果切片排队。当前 active build 是小红书私密发布、平台侧对账和持续反馈；闲鱼公开市场信号与 App Store 公开应用检索占用两个并行 research 槽位。随后是自有 App Store/Google Play 评论、发布状态和受控测试发布。

完整的 P0/P1/P2、Watch、Reject 和最小 Schema 见 [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)。同一时刻只实施一个切片，避免再次积累一批只有文档、没有闭环的“接入”。

## 文档

- [产品范围与价值门](docs/PRODUCT_SCOPE.md)
- [有价值的候选接入对象](docs/INTEGRATION_CANDIDATES.md)
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

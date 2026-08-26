# Knowledge

一个普通、独立的 Git repository，不是插件。它把三类东西放在同一个版本边界内：

```text
knowledge/   外部唯一可感知的 OKF 知识与 Capability 契约
connectors/  Capability 的隐藏执行逻辑
collectors/  knowledge 与 connectors 的隐藏维护逻辑
```

外部只消费 `knowledge/`。Connector 可以是确定性代码、Agent、人工流程或混合实现；Collector 可以持续检查来源、Schema、条款、probe 结果和 Connector 漂移，但默认只能生成 proposal/report。

## 仓库结构

```text
knowledge/
├── index.md
├── platforms/       平台知识，一平台一文件
├── tools/           工具知识，一工具一文件
├── sources/         信息源和数据源知识
├── concepts/        跨平台、跨工具概念
├── capabilities/    外部可发现、可调用的能力契约
├── schemas/         Capability 的产品输入输出 Schema
├── policies/        公开治理、授权和使用政策
├── verifications/   脱敏后的验证结论与证据摘要
└── references/      来源、术语和机器可读政策

connectors/
└── <connector-id>/
    ├── connector.json
    ├── src/
    └── test/

collectors/
└── <collector-id>/
    ├── collector.json
    ├── src/
    ├── prompts/      仅 Agent/Hybrid Collector 需要
    └── evals/

probes/
├── definitions/     可重复 probe 定义
├── identities/      仅 opaque ID 与 credential ref
└── pools/           合法身份池的选择、配额和隔离策略

spec/                上述控制面与 OKF Capability 扩展的 JSON Schema
scripts/             确定性校验和准入工具
test/                契约与负向测试
docs/                架构和决策
```

目录按职责分层，而不是给每个平台复制一套封闭知识树。Platform、Tool、Source、Concept、Capability、Schema 和 Verification 通过稳定路径与 Markdown links 组成图；Connector/Collector 用 `capabilityRef` 绑定图中的能力。

## 准入规则

一次 Git 变更只准入一个真实 Capability 及其最小闭环：

```text
Subject knowledge
+ Capability knowledge
+ input/output Schema
+ hidden Connector
+ repeatable ProbeDefinition
+ passed, unexpired VerificationReport
```

缺少任意一项就留在 `.staging/`，不进入 canonical `knowledge/`。真实用户名、邮箱、Cookie、token、密钥和运营身份清单永远不进 Git。

## 当前状态

```text
完整可用闭环：5（Information Source 3；Platform 2）
已准入 Subject：5
已准入 Capability：5
Connector：4 个已验证；xiaohongshu-browser 为 mixed（读取已验证、发布候选）
维护 Collector：5
```

小红书已有三个真实闭环：官方账号 API 参考、浏览器渲染的社区公约信息源，以及通过自有账号会话读取本人笔记列表的平台能力。后者 live probe 实际返回可用的空列表。笔记发布、详情反查与反馈采集仍是候选能力，尚未完成真实私密发布闭环。仓库不创建空的平台、Connector 或 Collector 占位。

小红书维护 Collector 还管理 24 个已审计开源项目，并消费已验证的 GitHub 搜索 Connector 做关键词轮换发现：每次串行查询 2 个关键词、5 天覆盖 10 个查询，只生成去重 triage proposal，不自动安装、路由或接受第三方许可证。

抖音已有一个真实闭环：无需身份读取并语义校验官方开放平台文档。它只是一条 Information Source 能力；应用审核、scope、用户授权和真实业务调用尚未验证，所以抖音 Platform 能力仍为 0。非官方 MediaCrawler 路线受许可证与登录状态约束，未被计为可用闭环。

GitHub 已有一个真实 Platform 闭环：通过官方 REST API、无需身份搜索公共仓库。输出强制声明排序分页、1,000 条结果窗口、`incomplete_results` 和 Search 限流状态；它只能发现候选，不能证明生态完整、项目许可证可用或项目能力可执行。

- [小红书接入调研与第一条能力纵切](docs/research/xiaohongshu-integration.md)

## 规范

- [仓库与命名约定](docs/REPOSITORY_CONVENTIONS.md)
- [单项能力准入流程](docs/ADMISSION_WORKFLOW.md)
- [Probe 身份与安全规则](docs/SECURITY_AND_IDENTITIES.md)
- [版本化控制面 Schema](spec/README.md)
- [完整架构推导](docs/ARCHITECTURE.md)

## 验证

`package.json` 只是仓库本地工具清单，不代表插件或发布包。

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm install
npm run check
```

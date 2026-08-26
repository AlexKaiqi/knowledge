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
├── services/        可调用公共服务知识
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

目录按职责分层，而不是给每个平台复制一套封闭知识树。Platform、Service、Tool、Source、Concept、Capability、Schema 和 Verification 通过稳定路径与 Markdown links 组成图；Connector/Collector 用 `capabilityRef` 绑定图中的能力。

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
完整可用闭环：14（Information Source 4；Platform 9；Service 1）
已准入 Subject：11
已准入 Capability：14
Connector：13 个已验证；xiaohongshu-browser 为 mixed（读取已验证、发布候选）
维护 Collector：15
```

小红书已有三个真实闭环：官方账号 API 参考、浏览器渲染的社区公约信息源，以及通过自有账号会话读取本人笔记列表的平台能力。后者 live probe 实际返回可用的空列表。笔记发布、详情反查与反馈采集仍是候选能力，尚未完成真实私密发布闭环。仓库不创建空的平台、Connector 或 Collector 占位。

小红书维护 Collector 还管理 40 个已审计开源项目，并消费已验证的 GitHub 搜索 Connector 做关键词轮换发现：每次串行查询 4 个关键词、5 天覆盖 20 个查询，显式覆盖 MCP、CLI、Playwright、浏览器扩展、多账号发布、数据采集、普通评论、直播评论、私信与创作者分析。项目必须能改变 Connector、Collector、probe、身份池、conformance 或 failure-domain 决策；只有关键词命中、没有具体平台路径或没有新增维护决策的仓库不进入目录。已人工排除的命中只保留最小 `discoveryDecision`（仓库、当时的 `pushedAt` 和理由码），相同 revision 不重复制造 proposal，仓库一旦更新就自动重新进入审阅。对其中 29 个声明关注 release 的项目，另消费已验证的 GitHub Tag Connector，每次串行观察 4 个、8 天覆盖一轮，并比较规范化的 tag→commit 摘要；不再让 Collector 自己理解 Git wire 输出。发现新项目或 tag 变化都只生成去重审阅 proposal，不自动安装、升级、路由或接受第三方许可证。当前已为 `DeliciousBuding/xiaohongshu-skill` 建立固定 commit、固定补丁与固定 runtime diff 的本地 JSON CLI adapter；它能在离线契约中强制私密可见性、隔离 profile，并对不确定写入禁重试，但在真实 probe 前仍不是可用路线。`xhs-analytics` 的自有创作者指标截获面已进入高优先级 Collector 调研；CreatorHub 的持久任务队列、身份/出口风控和私信唤醒，oba-live-tool 的千帆/蒲公英直播评论 WebSocket，以及 rednote-extract 的被动网络观测只作为维护与 schema 参考，尚不是可用能力。

抖音已有两个真实闭环：一条无需身份读取并语义校验官方开放平台文档的 Information Source 能力；一条按明确 VideoID 调用官方免权限接口、读取公开视频标题/宽高/受约束播放器 URL 的 Platform 能力。后者不暴露原始 iframe HTML，也不使用账号、Cookie、token、内部签名或爬虫身份伪装。应用审核、scope、用户授权、搜索、创作者数据和写操作仍未验证。

抖音维护 Collector 当前管理 24 个固定提交的开源项目和 11 条访问路线，区分官方 OpenAPI、创作者中心发布、草稿准备、公开读取、公开 Web 研究、自有创作者数据与人工恢复。每次串行查询 2 个关键词、5 天覆盖 10 个查询；同时观察项目和路线 HEAD。对 15 个声明关注 release 的项目，另消费已验证的 GitHub Tag Connector，每次串行观察 4 个、4 天覆盖一轮。当前只有官方公开视频 iframe API 是 `verified/full` 且可自动选择；已归档 `yzfly/douyin-mcp-server` 的旧分享页解析路线因 `iesdouyin` 重定向和 HTML 契约失效而退休。其余路线仍为 `researching`/`degraded`。MediaCrawler 的受限许可证、`social-media-copilot` 的许可证冲突、无许可证项目和“点击即成功”实现都被显式阻断，Collector 不会自动安装、登录、接受许可证或升级路线。

GitHub 已有四个真实 Platform 闭环：通过官方 REST API、无需身份搜索公共仓库；串行分页读取最多 500 个 tag 名称与目标 commit SHA；按精确 tag 读取一个非草稿 release 的有界说明和最多 64 个内嵌资产；以及在完整不可变 commit ID 下读取一个不超过 256 KiB 的 UTF-8 公共仓库文件。它们可以发现候选、观察 tag/release 面，并核验固定 revision 的 README、LICENSE、manifest 和实现证据；仍不能证明生态完整、许可证有效、tag 不会移动、资产集合完整、资产安全或项目能力可执行。

npm Public Registry 已有一个真实 Platform 闭环：无需身份按精确 package name 和精确 semver 读取最小化公共版本元数据。输出保留 license/deprecation/repository/engines 声明和 tarball 的 SHA-512 SRI、SHA-1 shasum、固定 Registry URL，同时排除 author、maintainers、contributors 和邮箱。它可用于依赖证据核验，但不下载或执行包，也不把 license 字段冒充独立授权结论。

PyPI 已有一个真实 Platform 闭环：无需身份按规范化项目名和精确版本读取官方 JSON release metadata。输出包含最小项目/许可证/Python 要求/yank/漏洞数量信号，以及最多 64 个发行文件的 SHA-256、BLAKE2b-256、Core Metadata 摘要、ETag 和 serial；作者、维护者、邮箱、漏洞详情、长许可证正文和无关项目链接被排除。它不下载、安装或执行发行物，也不把上传元数据当作源码、授权或安全审计。

crates.io 已有一个真实 Platform 闭环：无需身份按注册名精确拼写和精确 semver 读取官方版本 API。输出保留许可证、MSRV、edition、yank、发行时间、库/二进制形态、安全项目链接和 `.crate` SHA-256/大小/官方下载 URL；下载量、发布者、审计用户、features、dependencies 和 raw payload 被排除。Connector 遵守官方每秒最多一次请求与可联系 User-Agent 政策，但不下载、重算或执行归档。

OSV.dev 已有一个真实 Information Source 闭环：按精确 advisory ID 读取标准漏洞记录、affected ranges 和 references。版本清单明确标记样本覆盖，不能替代完整依赖扫描或安全结论。

Go Module Mirror 与 Checksum Database 已有一个真实 Service 闭环：调用者显式确认公开的 module path/version 后，Connector 固定 public proxy/SumDB，在全新隔离 cache 中用官方 Go verifier 认证模块树和 go.mod h1。归档最多 32 MiB，会被下载但不执行，成功前删除 cache；`.info` 时间只标记为 transport-only。私有路径、latest/range、direct fallback、依赖求解、构建和执行都不在能力内。

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

# 构建并核验第二条小红书候选路线；不会登录或触发平台写入
npm run xhs:skill:bootstrap

# 显式创建/更新仓库外的隔离登录态；会打开可见浏览器
KNOWLEDGE_XHS_SKILL_PROFILE=<profile-id> npm run xhs:skill:login

# 需要显式提供仓库外的 opaque profile；doctor 只读检查登录态
KNOWLEDGE_XHS_SKILL_PROFILE=<profile-id> npm run xhs:skill:doctor
```

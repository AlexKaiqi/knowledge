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
完整可用闭环：20（Tool 1；Information Source 4；Platform 14；Service 1）
已准入 Subject：16
已准入 Capability：20
Connector：19 个已验证；xiaohongshu-browser 为 mixed（读取已验证、发布候选）
维护 Collector：21
```

Web Feed Reader 已形成第一条 Tool 闭环：外部只按固定 `feedId` 读取逐项审阅的公共 Feed，不接受任意 URL、header、凭据或重定向。当前唯一登记源是 Node.js 官方 Release Feed；production-public live probe 实际解析 RSS 2.0 的 807 个条目并有界返回 10 个。输出剔除正文、摘要、作者、邮箱、附件、扩展字段和 raw XML，并把归一化语义摘要与原始文档摘要分开，使 Collector 能区分真实条目变化和序列化噪声。解析器的 Atom 1.0 路径已通过本地契约测试，但在首个 Atom 来源独立 live probe 前不算可用 Atom 数据源。维护 Collector 同时观察 RSS/Atom 规范、Node.js 官网 Feed 生成源码、生成器和精确固定的 XML parser 上游；变化只生成 proposal。

小红书已有三个真实闭环：官方账号 API 参考、浏览器渲染的社区公约信息源，以及通过自有账号会话读取本人笔记列表的平台能力。后者 live probe 实际返回可用的空列表。笔记发布、详情反查与反馈采集仍是候选能力，尚未完成真实私密发布闭环。仓库不创建空的平台、Connector 或 Collector 占位。

小红书维护 Collector 管理 47 个已审计开源项目。它使用已验证的 GitHub Search Connector，每次串行查询 4 个关键词、7 天覆盖 28 个查询；36 个 release watch 使用 GitHub Tag Connector，每次观察 4 个、9 天覆盖一轮。首个 `tamnd/xiaohongshu-cli` 项目还使用 Work Item Connector 独立观察 issue/PR 增量窗口；checkpoint 只有审阅 proposal 才能推进，限流、截断和契约漂移不会被误报为“无变化”。其余项目的 issue，以及所有项目的 license、archive、契约与相关代码差异，仍在信号触发或复审到期后进入审阅清单。项目只有能改变 Connector、Collector、probe、身份池、conformance 或 failure-domain 决策才进入目录；所有变化只生成 proposal，不自动安装、升级、路由或接受第三方许可证。当前本地 JSON CLI adapter 仍须通过真实 probe 才可成为路线；Cookie 输出、原始身份数据落盘、风控规避建议、许可证血缘不明和不透明预编译二进制均保持 blocked/research-only。

抖音已有两个真实闭环：一条无需身份读取并语义校验官方开放平台文档的 Information Source 能力；一条按明确 VideoID 调用官方免权限接口、读取公开视频标题/宽高/受约束播放器 URL 的 Platform 能力。后者不暴露原始 iframe HTML，也不使用账号、Cookie、token、内部签名或爬虫身份伪装。应用审核、scope、用户授权、搜索、创作者数据和写操作仍未验证。

抖音维护 Collector 当前管理 24 个固定提交的开源项目和 11 条访问路线，区分官方 OpenAPI、创作者中心发布、草稿准备、公开读取、公开 Web 研究、自有创作者数据与人工恢复。每次串行查询 2 个关键词、5 天覆盖 10 个查询；同时观察项目和路线 HEAD。对 15 个声明关注 release 的项目，另消费已验证的 GitHub Tag Connector，每次串行观察 4 个、4 天覆盖一轮。当前只有官方公开视频 iframe API 是 `verified/full` 且可自动选择；已归档 `yzfly/douyin-mcp-server` 的旧分享页解析路线因 `iesdouyin` 重定向和 HTML 契约失效而退休。其余路线仍为 `researching`/`degraded`。MediaCrawler 的受限许可证、`social-media-copilot` 的许可证冲突、无许可证项目和“点击即成功”实现都被显式阻断，Collector 不会自动安装、登录、接受许可证或升级路线。

GitHub 已有五个真实 Platform 闭环：通过官方 REST API、无需身份搜索公共仓库；串行分页读取最多 500 个 tag 名称与目标 commit SHA；按精确 tag 读取一个非草稿 release 的有界说明和最多 64 个内嵌资产；在完整不可变 commit ID 下读取一个不超过 256 KiB 的 UTF-8 公共仓库文件；以及从复合 checkpoint 增量读取最多 5×100 个公共 issue/pull-request 变化。Work Item 能力重读边界前一秒，并用 number+语义摘要识别同秒重放；正文只保留长度与 SHA-256，作者、assignee、邮箱、头像、评论和 raw payload 被排除。它们可以发现候选、观察 tag/release/issue 面，并核验固定 revision 的 README、LICENSE、manifest 和实现证据；仍不能证明生态或历史完整、许可证有效、tag 不会移动、资产安全、分页期间没有并发缺口或项目能力可执行。

Hugging Face Hub 已有一个真实 Platform 闭环：无需身份按 `namespace/name` 和完整 40 位 commit 读取公开、非 gated、未禁用模型的有界完整文件清单。输出包含 pipeline/library/tags、文件路径和声明大小、Git blob SHA-1 及可用的 LFS SHA-256/Xet hash，并显式返回官方 5 分钟 `api` RateLimit 观测；不读取本机 HF token，不接受 `main`/tag，不下载或执行模型文件，也不把模型卡的 `license:*` tag 当作许可证审计。

Docker Hub 已有一个真实 Platform 闭环：无需 Docker ID，Connector 内部交换只含目标公开仓库 `pull` scope 的匿名短期 token，再按精确 `sha256` digest 读取 OCI/Docker schema 2 image index 或 image manifest。响应字节在本地重算摘要，并与请求和 `Docker-Content-Digest` 三方核对；输出保留有界 descriptor 次序、平台选择字段和已识别 attestation 引用，但不接受 tag，不下载 config/layer/attestation blob，不执行镜像，也不把 descriptor 或 annotation 冒充签名、provenance、安全或许可证结论。维护 Collector 同时观察 Docker Docs、Distribution 实现、OCI Distribution Spec 与 OCI Image Spec 四个开源上游；变化只生成 proposal。

Maven Central 已有一个真实 Platform 闭环：无需身份按精确非 SNAPSHOT GAV，从 Maven 官方 Central endpoint 完整读取 POM、主 JAR、两份强制 SHA-1 sidecar 和 JAR PGP sidecar。Connector 验证 POM 有效坐标/`jar` packaging、POM/JAR 的本地 SHA-1、sidecar 与 Central checksum header，并自行计算 SHA-256；不读取 Maven settings/`~/.m2`，不使用 mirror，不解析依赖，不安装或执行 JAR。PGP sidecar 只证明存在和字节稳定，未完成 key/trust/密码学验签。维护 Collector 同时语义观察三份官网契约和 Apache Maven、Maven Resolver、Maven Site 三个开源上游，变化只生成 proposal。

NuGet.org 已有一个真实 Platform 闭环：无需身份按精确 Package ID 和规范化版本，经官方 V3 service index 发现 Registration 与 Package Content 资源，读取最小元数据并完整下载不超过 32 MiB 的 `.nupkg`。Connector 本地计算 SHA-256/SHA-512、扫描有界 ZIP 中央目录，并确认根级 `.nuspec` 与 `.signature.p7s`；当前中国区 `api.nuget.org → nuget.azure.cn` 302 只作为一跳同路径传输路由接受。签名 entry 只证明存在，未完成 CMS、证书链、时间戳或 repository trust 验证；依赖不解析，包不解压、安装或执行。Collector 语义观察五组官网契约，并检查 NuGet.Client、NuGetGallery 与 NuGet Docs 三个官方开源上游。

npm Public Registry 已有一个真实 Platform 闭环：无需身份按精确 package name 和精确 semver 读取最小化公共版本元数据。输出保留 license/deprecation/repository/engines 声明和 tarball 的 SHA-512 SRI、SHA-1 shasum、固定 Registry URL，同时排除 author、maintainers、contributors 和邮箱。它可用于依赖证据核验，但不下载或执行包，也不把 license 字段冒充独立授权结论。

PyPI 已有一个真实 Platform 闭环：无需身份按规范化项目名和精确版本读取官方 JSON release metadata。输出包含最小项目/许可证/Python 要求/yank/漏洞数量信号，以及最多 64 个发行文件的 SHA-256、BLAKE2b-256、Core Metadata 摘要、ETag 和 serial；作者、维护者、邮箱、漏洞详情、长许可证正文和无关项目链接被排除。它不下载、安装或执行发行物，也不把上传元数据当作源码、授权或安全审计。

crates.io 已有一个真实 Platform 闭环：无需身份按注册名精确拼写和精确 semver 读取官方版本 API。输出保留许可证、MSRV、edition、yank、发行时间、库/二进制形态、安全项目链接和 `.crate` SHA-256/大小/官方下载 URL；下载量、发布者、审计用户、features、dependencies 和 raw payload 被排除。Connector 遵守官方每秒最多一次请求与可联系 User-Agent 政策，但不下载、重算或执行归档。

OSV.dev 已有一个真实 Information Source 闭环：按精确 advisory ID 读取标准漏洞记录、affected ranges 和 references。版本清单明确标记样本覆盖，不能替代完整依赖扫描或安全结论。

Go Module Mirror 与 Checksum Database 已有一个真实 Service 闭环：调用者显式确认公开的 module path/version 后，Connector 固定 public proxy/SumDB，在全新隔离 cache 中用官方 Go verifier 认证模块树和 go.mod h1。归档最多 32 MiB，会被下载但不执行，成功前删除 cache；`.info` 时间只标记为 transport-only。私有路径、latest/range、direct fallback、依赖求解、构建和执行都不在能力内。

- [小红书接入调研与第一条能力纵切](docs/research/xiaohongshu-integration.md)
- [Web Feed Reader 调研与接入决策](docs/research/web-feed-reader.md)
- [GitHub 公共仓库 Work Item 变更接入调研](docs/research/github-public-work-item-changes.md)

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

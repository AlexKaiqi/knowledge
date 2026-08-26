---
type: Log
title: Knowledge bundle history
---

# Bundle history

## 2026-08-26

- 初始化 OKF knowledge、Connector、Collector 与 probe 的单仓库边界。
- 初始化知识类型目录、控制面 Schema 和准入规范。
- 增加小红书浏览器 Connector 与维护 Collector 候选；只完成本地契约验证，未进入 canonical knowledge。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均为 0。

## 2026-08-27

- 通过 live probe 准入“小红书账号开放平台 API 参考”Information Source 与“读取账号 API 接口面”Capability。
- 增加无凭据、无副作用的 `xiaohongshu-account-docs` Connector，以及只生成 proposal/report 的维护 Collector。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均更新为 1；小红书笔记发布等平台业务能力仍未准入。
- 通过自有账号只读 live probe 准入“小红书”Platform 与“读取本人笔记”Capability；验证时实际返回 0 条的合法空列表。
- Connector conformance 支持按 Capability handler 独立声明，`xiaohongshu-browser` 的读取 handler 已验证，发布 handler 继续继承 candidate 状态。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均更新为 2。
- 通过真实浏览器渲染准入“小红书社区公约 2.0”Information Source 与社区规则接口面 Capability；静态 SPA 外壳不再被当作有效观测。
- 增加 Agent 只读浏览器观测 + 确定性语义归一化的 hybrid Connector，以及 proposal-only hybrid Collector。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均更新为 3。
- 通过公开 live probe 准入“抖音开放平台官方文档”Information Source 与能力接口面 Capability；5 个官方页面、7 类文档能力和 2 项安全要求均通过确定性语义校验。
- 明确“文档存在”不等于“当前应用可调用”；抖音应用审核、scope、用户授权和业务操作仍未形成 Platform 闭环。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均更新为 4。
- 通过公开 live probe 准入 GitHub Platform 与“搜索公共仓库”Capability；官方 REST API `2026-03-10` 版本实际命中已知小红书项目。
- 搜索输出固定为有界 `ranked-page`，显式保留 Search 限流、`incomplete_results` 和 1,000 条窗口，并将 `ecosystemComplete` 固定为 false。
- 增加 proposal-only Collector，持续检查 API conformance、验证过期，以及 fixture 的归档、禁用、许可、可见性和默认分支变化。
- 完整可用闭环、已准入 Subject 和已准入 Capability 均更新为 5。
- 小红书 Collector 接入已验证的 GitHub 搜索 Connector；每次串行发现 2 个关键词，5 天轮换覆盖全部 10 个查询，并过滤 `xhs` / `rednote` 同名噪声。
- 开源项目 watch catalog 从 18 项扩展到 24 项；新审计 6 项中 2 项保持 MIT researching、1 项 GPL research-only、3 项因缺许可证和高风险写行为 blocked。
- 小红书 Collector 补齐 release 声明的实际观测：17 个项目保存规范化 tag→commit 基线，每次串行检查 4 个、5 天覆盖一轮；变化只生成审阅 proposal，不自动升级 Connector 或写入 OKF。
- 通过公开 live probe 准入“读取 GitHub 公共仓库文件”Capability；官方 Contents API 在完整 commit ID 下返回已知 README，Git blob ID 与正文 SHA-256 均匹配固定预期。
- Connector 拒绝 branch/tag、目录、路径穿越、超过 256 KiB、非 UTF-8、二进制 NUL、revision 漂移和失败重试；新增 proposal-only Collector 观察内容完整性、API conformance 与验证过期。
- 完整可用闭环更新为 6（Information Source 3；Platform 3），已准入 Subject 保持 5，Capability 更新为 6。
- 通过公开 live probe 准入 npm Public Registry Platform 与“读取公共包精确版本元数据”Capability；`ajv@8.20.0` 的包身份、许可证声明、仓库地址、SRI、shasum 和 tarball URL 均命中固定证据。
- Connector 固定公共 Registry，只接受精确 semver，拒绝 tag/range、alternate registry、重定向、超限响应和发行完整性漂移；输出剔除 author、maintainers、contributors 与邮箱。
- 新增 proposal-only Collector 观察精确版本的发行完整性、许可证/废弃/仓库元数据变化和验证过期；完整可用闭环更新为 7（Information Source 3；Platform 4），Subject 更新为 6，Capability 更新为 7。
- 通过公开 live probe 准入 PyPI Platform 与“读取公共项目精确 Release 元数据”Capability；`sampleproject==4.0.0` 的项目身份、Python 要求、MIT classifier、wheel/sdist 文件及 SHA-256/BLAKE2b-256/Core Metadata 摘要均命中固定证据。
- Connector 固定官方 release JSON API，只接受规范化项目名与精确版本，限制 2 MiB 响应和 64 个发行文件，并验证 ETag、serial 与 `files.pythonhosted.org`；输出剔除个人字段、漏洞详情、长许可证正文和无关链接。
- 新增 proposal-only Collector 观察语义摘要、发行完整性、yank/漏洞数量/许可证变化、验证过期和限流；完整可用闭环更新为 8（Information Source 3；Platform 5），Subject 更新为 7，Capability 更新为 8。
- 通过 production-public live probe 准入 Go Module Mirror 与 Checksum Database Service，以及“读取并认证公共 Go 模块精确版本”Capability；`rsc.io/quote@v1.5.2` 的模块树 h1、go.mod h1/SHA-256、版本身份和 2,987-byte 归档均命中固定证据。
- Connector 固定官方 public proxy/SumDB，要求显式公开路径确认，拒绝 latest/range、direct/VCS fallback、超 32 MiB 归档和裸 `/lookup` 信任；官方 Go verifier 在隔离 cache 中完成透明日志认证，归档不执行且 cache 已清理。
- 新增 proposal-only Collector 观察精确模块证据、Go verifier、认证漂移、验证过期和限流；完整可用闭环更新为 9（Information Source 3；Platform 5；Service 1），Subject 更新为 8，Capability 更新为 9。
- 通过 production-public live probe 准入“读取 GitHub 公共仓库 Tag 集合”Capability；官方 Tags API 匿名返回 `tamnd/xiaohongshu-cli` 的完整 2-tag 集合，两个 tag 的目标 commit 均命中固定证据。
- Connector 内部串行处理官方分页，每页最多 100、总计最多 500、单页 2 MiB；输出明确完整/截断、`core` 限流和规范化 tag→commit 摘要，并排除 tagger、消息、签名、archive URL 与原始 payload。
- 新增 proposal-only Collector 观察 tag 集合、已知 tag 身份、验证过期和限流；小红书 Collector 的 17 项 release watch 改为消费该已验证 Connector。完整可用闭环更新为 10（Information Source 3；Platform 6；Service 1），Subject 保持 8，Capability 更新为 10。
- 抖音 Collector 补齐 15 个 `release` watch 的实际执行：保存规范化 tag→commit 基线，每次串行调用已验证的 GitHub Tag Connector 观察 4 个、4 天覆盖一轮；变化、限流、截断和契约漂移分别生成 proposal，不自动升级候选路线。
- 通过 production-public live probe 准入 crates.io Platform 与“读取公共 crate 精确版本元数据”Capability；`serde@1.0.228` 的 crate 身份、MIT/Apache-2.0 声明、Rust 1.56、2021 edition、83,652-byte 发行物和 SHA-256 均命中固定证据。
- Connector 固定官方 API，只接受注册名精确拼写与精确 semver，内置最短 1 秒请求闸门和带联系 URL 的应用 User-Agent；拒绝 alternate registry、重定向和超 1 MiB 响应，输出剔除下载量、发布者、审计用户、头像、features、dependencies 与原始 payload。
- 新增 proposal-only Collector 观察发行摘要、yank/许可证/MSRV/edition/链接变化、API policy block、验证过期和访问失败；完整可用闭环更新为 11（Information Source 3；Platform 7；Service 1），Subject 更新为 9，Capability 更新为 11。
- 通过 production-public live probe 准入 OSV.dev Information Source 与“读取公共 OSV 漏洞公告”Capability；固定公告的精确身份、poppler Git introduced/fixed 边界和 REPORT reference 均命中。
- Connector 固定按 ID 官方 API，限制 2 MiB；details 与版本清单有界并带完整 hash/coverage，排除 credits 和 database/ecosystem-specific raw 扩展。完整闭环更新为 12（Information Source 4；Platform 7；Service 1），Subject 10，Capability 12。
- 通过 production-public live probe 准入“按精确 Tag 读取 GitHub 公共仓库 Release”Capability；`JoeanAmier/XHS-Downloader` 的 `2.7` release 身份、说明摘要及 4 个资产名称、大小和 GitHub 提供的 SHA-256 均命中固定证据。
- Connector 固定官方 release-by-tag API，单次响应最多 2 MiB、内嵌资产最多 64 个，不跟随重定向或重试；输出排除 author、uploader、头像、下载计数和源码归档链接。首次 live 结果因说明正文包含合法的 `Cookie` 文字触发了错误的值级最小化断言；修正为字段级断言后，对同一 live 快照离线复核通过，未重复发起网络请求。完整闭环更新为 13（Information Source 4；Platform 8；Service 1），Subject 10，Capability 13。
- 通过 production-public live probe 准入抖音 Platform 与“读取公开视频嵌入描述”Capability；官方免权限接口实际返回固定 VideoID 的公开标题、1080×1920 画面尺寸和官方播放器 URL。
- Connector 固定 `open.douyin.com` 单一 endpoint，不跟随重定向或重试，限制 64 KiB JSON；解析并验证 iframe 后只重建 `autoplay=0` 播放器 URL，排除原始 HTML、日志、作者、互动指标、评论、媒体直链与 raw payload。
- 新增 proposal-only Collector 观察接口契约、固定公开视频可用性、最小描述漂移与验证过期；旧 `iesdouyin` 分享页 `_ROUTER_DATA` 路线因当前重定向和反爬页面失效而退休。完整闭环更新为 14（Information Source 4；Platform 9；Service 1），Subject 11，Capability 14。
- 通过 production-public live probe 准入 Hugging Face Hub Platform 与“读取公共模型 Revision 清单”Capability；匿名官方 API 在固定 `openai-community/gpt2` commit 下实际返回完整 26 文件、5,632,417,295-byte 声明总量和 Git/LFS 完整性标识。
- Connector 只接受 `namespace/name` 与完整小写 40 位 commit，固定 `blobs=true`、4 MiB/1,024 文件上限、不跟随重定向或重试，并显式关闭凭据面；输出排除作者、下载量、点赞、Spaces、widget/card data、请求 ID 和 raw payload，且不下载或执行模型文件。
- 新增 proposal-only Collector 持续观察模型公开/gated/disabled 状态、分类、完整文件摘要、官方 `api` RateLimit 契约、fixture 消失和验证过期。完整闭环更新为 15（Information Source 4；Platform 10；Service 1），Subject 12，Capability 15。
- 通过 production-public live probe 准入 Docker Hub Platform 与“读取公共镜像 Manifest”Capability；匿名 Registry V2 在固定 `library/alpine@sha256:48b030…` 下实际返回 9,218-byte OCI index、16 个 descriptors、8 个 Linux 平台 manifest 和 8 个关联 attestation manifest。
- Connector 内部执行匿名 pull token exchange，只接受精确 digest，独立重算响应 SHA-256 并核对 canonical digest header；限制 4 MiB/256 descriptors、不跟随重定向或重试，不下载 config/layer/attestation blob，输出排除 token、source IP、tag、annotations 和 raw payload。
- 新增 proposal-only Collector 持续检查固定 manifest、pull 限流契约、验证过期，以及 Docker Docs、Distribution、OCI Distribution Spec、OCI Image Spec 四个开源上游 HEAD；变化不自动升级契约。完整闭环更新为 16（Information Source 4；Platform 11；Service 1），Subject 13，Capability 16。
- 通过 production-public live probe 准入 Maven Central Platform 与“读取公共 JAR Release 证据”Capability；`junit:junit:4.13.2` 的 27,018-byte POM、384,581-byte JAR 和 833-byte PGP sidecar 均命中固定本地 SHA-1/SHA-256，POM/JAR SHA-1 同时匹配 Central 强制 sidecar 与 checksum header。
- Connector 固定官方 `repo.maven.apache.org/maven2` repository layout，串行五次 GET，只接受精确非 SNAPSHOT GAV 与主 JAR，限制 POM 1 MiB/JAR 32 MiB/signature 256 KiB；输出排除 developer/contributor/email、依赖图、raw POM 和传输字段，不读取 settings/mirror/cache，也不安装或执行 JAR。PGP sidecar 明确为存在但未密码学验签。
- 新增 proposal-only Collector 语义观察 checksum/signature、immutability、repository layout 三份官网契约，并检查 Apache Maven、Maven Resolver、Maven Site 三个固定 revision 开源上游 HEAD；变化不自动更新契约。完整闭环更新为 17（Information Source 4；Platform 12；Service 1），Subject 14，Capability 17。

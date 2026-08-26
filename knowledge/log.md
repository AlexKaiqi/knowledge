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

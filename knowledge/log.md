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

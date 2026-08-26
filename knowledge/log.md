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

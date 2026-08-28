# OpenConnector：借执行架构，不借目录真相

状态：已完成 source audit；一个隐藏 Connector candidate 与一个 proposal-only Collector 已落地；没有新增 canonical Capability  
审计日期：2026-08-27  
固定实现基线：`oomol-lab/open-connector` `v1.4.0` / `96fb6afe8c244c7d6f3a8351df06d7b04137f6a6`

## 决策

OpenConnector 适合作为隐藏执行基础设施，不适合作为 OKF 知识目录。

```text
OKF Capability
→ Capability Gateway 的隐藏 route policy
→ 我们维护的能力专用、强约束、去身份 adapter
→ OpenConnector Action + Connection
→ 实际上游 API / 托管供应商
```

我们按结果而不是 provider 数量集成：

- 没有边际供应商费用、授权边界清楚、维护成本合理、且已经能由本仓库 live/sandbox 验证的能力，由我们直接拥有。GitHub 搜索/文件/tag/release/work-item、arXiv metadata、Hugging Face 精确 revision 和 Apple 公开应用搜索继续走现有直接 Connector，不再经过 OpenConnector 复制一层。
- 供应商付费、OAuth 运维、协议差异或独立故障域确实值得隔离时，OpenConnector 可以成为某一能力的隐藏 route。每个 action 仍要独立做用途、权限、价格、Schema、最小化与 live probe；“provider 已在目录”不算接入。
- OOMOL 托管版可以作为另一个商业故障域，但只有机器接口、账单回执、输出最小化和目标平台使用权都实测后才从 `researching` 变成 candidate。

“免费”在这里不是“仓库开源”或“套餐写 Free”，而是：在合法用途下没有边际 provider 费用，不要求我们用高风险身份/绕过策略维持，并能承受持续验证与维护。账号赠送调用量仍是供应商路线，不会自动成为自有能力。

## 两个同名项目必须分开

| 项目 | 审计结论 | 本仓库处理 |
| --- | --- | --- |
| `oomol-lab/open-connector` | Apache-2.0 的真实运行时；有 Provider、Action、Executor、Connection、runtime token、HTTP/MCP/OpenAPI surface 和大量 provider 定义 | 作为 candidate execution substrate 与架构参考；固定 revision、逐 action probe |
| `openconnector-dev/openconnector` | README 明确说代码仍在准备公开；当前仓库只是产品与文档入口，虽有 AGPL LICENSE 但没有可运行实现 | 排除出集成，只低频观察它是否真的发布代码 |

## 值得吸收的架构

1. **Provider / Action / Executor 分离**：Provider 描述授权类型和 action 目录；Action 冻结名称、输入输出 Schema、scope 和 permission；Executor 才接协议。这能避免把“平台”误当一个万能 Connector。
2. **Connection 是运行时绑定，不是知识**：同一 provider 可以有多个命名连接；凭据只在 Connection 中，调用契约只携带稳定 connection selector。我们继续把 account binding、credential ref 与 OKF 分离。
3. **同一 Action 契约可跨 self-hosted / hosted**：只要 action ID、Schema 和错误语义稳定，Gateway 可以把付费托管与自托管实现当隐藏 route，而外界不感知供应商。
4. **Action、proxy、connection grant 分层**：runtime token 的 action allow/block、proxy grant 和 connection grant 相互独立。我们应采用交集授权，并默认禁用通用 proxy；不能因为允许一个搜索 action 就获得整个 provider 代理能力。
5. **验证状态分层**：OpenConnector 自己明确区分 catalog-only、locally executable、externally verified。这与本仓库 candidate/verified 边界一致，也说明 provider 数量不能换算成可用能力数量。
6. **统一运行 envelope 与可重放语义**：一致的 success/data/meta envelope、明确的 HTTP 错误和幂等冲突处理值得借鉴。但幂等只适合有副作用且需要重复抑制的 action，不能默认用于公共研究读取。

## 明确不吸收的部分

- 不导入 provider catalog、Action guide 或 OpenAPI 为 canonical knowledge；模型已经知道的普通 API 操作没有必要在 OKF 重复积累。
- 不把 provider-level、schema-level 或本地 executor-level 覆盖冒充 live conformance。固定源码审计发现 v1.4.0 有 1,395 个 provider definition/executor 组合，但仅 54 个 provider 目录有本地 test/spec 文件；TikHub 目录没有 provider-local test。这个数字只表示审计范围，不表示项目整体测试数或 54 个真实上游已验证。
- 不直接透传 OpenConnector 的 TikHub social output。它的公开 Schema保留 `rawData` 与 `raw`，Xiaohongshu/Douyin 的 `results` 又是 loose/raw payload；这不满足稳定公共 Schema、去身份和最小 retention。
- 不接受无 encryption key 的默认本地开发存储。官方文档说明这种模式会把 credential、OAuth state 和已完成的幂等 action response 明文保存；即使配置密钥，24 小时 replay record 也不是物理删除保证。
- 不开放通用 provider proxy，不自动重试付费 action，不自动分页，不下载媒体，也不因为 route 失败就换账号、换 provider 或扩大 scope。

## 本轮落地

`connectors/openconnector-public-social-search/` 是不可自动路由的 component candidate。它只允许：

- loopback self-hosted OpenConnector runtime；
- 固定 v1.4.0 中的 `tikhub.search_xiaohongshu_notes` 或 `tikhub.search_douyin_videos`；
- 单个关键词、第一页/初始 cursor、一次请求、无 retry；
- runtime token 与 TikHub credential 分离，connection alias 显式；
- 只从 OpenConnector envelope 提取 `results`，丢弃重复的 `rawData`/`raw`；但仍把 `results` 标成 `safeForOkf=false`、`identityRemoved=false` 和 ephemeral internal handoff。

它尚未定义 public result Schema，也没有创建 `/knowledge/capabilities/research/search-public-social-content.md`。下一步不是写知识，而是人工批准一次最高 USD 1 的 live probe：先审平台/供应商条款和价格，配置加密 loopback runtime 与最小 action/connection grant，执行一个固定小红书 query，确认真实返回形状，再设计去身份投影并立即销毁原始 payload。

`collectors/openconnector-upstream-maintainer/` 持续观察固定 action/runtime/credential/verification 契约、OOMOL 价格和 Public Social Research Skill、两个同名项目的 HEAD，以及 OOMOL 项目的规范化 release tag 集。任何变化只生成 proposal；Collector 不安装、不登录、不接受条款、不花钱、不自动启用或切换 route。

## 证据

- OpenConnector repository：<https://github.com/oomol-lab/open-connector>
- Verification state：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/verification.md>
- Runtime API / token / connection grants：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/runtime-api.md>
- Credential storage：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/docs/credentials.md>
- TikHub Action contract：<https://github.com/oomol-lab/open-connector/blob/v1.4.0/src/providers/tikhub/actions.ts>
- OOMOL managed Skill：<https://oomol.com/en/skills/@alwaysmavs/public-social-research/>
- OOMOL pricing：<https://oomol.com/en/pricing/>
- 同名 placeholder：<https://github.com/openconnector-dev/openconnector/blob/main/README.md>

# Web Feed Reader 调研与接入决策

## 目标

把 RSS/Atom 作为可复用的低成本变更信号接入 OKF，同时避免把“任意 URL 抓取”伪装成安全、统一的数据源能力。公共面只暴露已登记 Feed；来源发现、XML 解析、规范差异、网络限制和持续维护都隐藏在 Connector/Collector 后面。

## 调研证据

- RSS 2.0 以 channel/item 为核心，规范要求根 `rss` 的 `version` 为 `2.0`；item 的 guid、link、pubDate 等字段均可能缺失或采用来源自定义约定。来源：[RSS 2.0 Specification](https://www.rssboard.org/rss-specification)。
- Atom 1.0 是 IETF Standards Track 文档，使用 `http://www.w3.org/2005/Atom` namespace，并对 feed/entry 的 id、title、updated、link 等提供另一套模型。来源：[RFC 4287](https://www.rfc-editor.org/rfc/rfc4287.html)。
- Node.js 官网公开 `https://nodejs.org/en/feed/releases.xml`，当前为 RSS 2.0。官网源码在 `apps/site/site.json` 登记 route，并在 `apps/site/util/feeds.ts` 通过 `feed` 库生成 RSS。来源：[nodejs.org 源码](https://github.com/nodejs/nodejs.org)、[Feed 生成器](https://github.com/jpmonette/feed)。
- Connector 使用 `saxes@6.0.0` 做严格、namespace-aware 的流式 XML 解析；依赖固定精确版本和 lockfile，ISC 许可已核验。上游 HEAD 只作为升级复审信号，不自动改变依赖。来源：[saxes](https://github.com/lddubeau/saxes)。

## 抽象决策

公共 Capability 是 `read-registered-public-feed({feedId, limit})`，不是 `fetchFeed({url})`。每个 `feedId` 都绑定固定 URL、预期格式、Feed 身份、允许的条目链接 origin、资源预算和验证 fixture。这样调用者不用理解 RSS/Atom 差异，Connector 也不会形成 SSRF、任意内网探测、凭据/header 注入或无限下载入口。

业务输出不强制所有产品使用同一 schema。这里的 Feed schema 只统一该工具真正稳定的最小交集：身份、标题、链接、时间、覆盖范围与摘要。不同平台若需要正文、作者、附件或专有扩展，应建立自己的 Subject/Capability/schema 和独立审阅，而不是不断放宽通用 Reader。

## 安全与失败边界

- 单一固定 HTTPS endpoint；拒绝调用者 URL、重定向、凭据、代理和失败重试。
- 响应最多 512 KiB，文档最多 1,000 个条目，每次最多返回 20 个。
- UTF-8 严格解码；拒绝 DTD、重复关键字段、标题 markup、无效日期和不符合登记 origin 的条目链接。
- 不返回正文、摘要、作者、邮箱、enclosure、扩展字段或 raw XML。
- `feedDigest` 表示稳定 Feed 身份和条目最小字段，不包含 Feed-level build/update time；`documentSha256` 表示完整响应字节。两者分离，避免构建时间、namespace/扩展或序列化变化污染知识基线。
- 不把 Feed 当作不可变日志：条目可被修改、重排、删除，分页/历史完整性也不由 RSS/Atom 保证。

## 当前验证

production-public live probe 对 Node.js Release Feed 解析到 807 个条目，有界返回 10 个，并命中固定 `Node.js 24.20.0 (LTS)` 条目。Feed 身份、RSS 2.0、条目唯一性、固定链接来源、资源预算和最小化字段均通过。Atom 解析只有离线契约测试，因此当前准入的是一个 RSS 来源，而不是笼统宣称所有 RSS/Atom Feed 均可用。

## Collector 维护面

Collector 每次串行执行：

1. 语义观察 RSS 2.0 规范与 Atom RFC 的关键断言；
2. 检查 `nodejs/nodejs.org`、`jpmonette/feed`、`lddubeau/saxes` 的固定 branch HEAD；
3. 读取登记 Feed，比较 conformance、`feedDigest` 与 `documentSha256`；
4. 检查 live report 是否过期。

语义变化生成 knowledge proposal；仅原始 XML 字节变化时保留 `document-only` 观测但不生成 proposal，因为 Node.js 的 `lastBuildDate` 会随无语义变化的站点构建刷新；规范或上游 HEAD 漂移生成实现复审 proposal；限流延期；来源消失进入退役复审。Collector 不自动新增 Feed、不升级依赖、不改 schema、不覆盖基线，也不自动接受许可变化。

下一条 Feed 必须以同样方式逐项准入。优先选择能维护现有平台/工具知识、公开稳定、无需身份且有官方规范或源码证据的 Feed，而不是追求数量。

# 小红书接入调研与第一条能力纵切

状态：实现候选；canonical knowledge 尚未准入

核验日期：2026-08-26

目标：让外部只看到一项稳定知识能力，隐藏登录态、可见浏览器、sidecar、页面选择器、`xsec_token`、基线差分和反馈去身份化等复杂度。只有真实私密发布、平台侧反查和初次反馈观察全部通过后，才把能力写入 `knowledge/`。

## 1. 第一性边界

我们要交付的不是“能调用一个小红书脚本”，而是：

> 对一个用户明确授权的自有账号，使用冻结且一次确认的 revision 发布一条仅自己可见的笔记，并从账号本人主页重新发现该笔记，再从详情页核对内容并读取初始指标/评论，最终返回不含内部访问凭据的稳定 receipt。

以下情况都不算闭环：

- 仅能登录；
- HTTP 返回 200；
- 点击了发布按钮；
- 页面离开发布表单；
- 能在推荐流搜索到同名内容；
- mock 测试通过；
- 本机二进制成功构建。

## 2. 接入方法调研

| 路径 | 官方性 | 实际能力 | 能否承担本纵切 | 结论 |
| --- | --- | --- | --- | --- |
| 小红书账号开放平台 | 官方 | OAuth 2.0 / PKCE / Device Flow、token 校验、最小用户资料 | 否；没有笔记发布、本人笔记列表或反馈接口 | 将来可作为标准身份授权来源，不能代替发布 Connector |
| 小红书分享开放平台 | 官方 | Android/iOS/HarmonyOS/JS 把图片或视频交给小红书 App 发布流程 | 否；当前限制自动填充标题、正文、话题，流程由用户在 App 内完成，也没有可供服务端闭环的笔记 ID/反馈接口 | 作为人工交接型 fallback，不冒充自动发布 |
| 小红书电商开放平台 | 官方 | 店铺 ERP、打单、搬家上货、进销存等商家能力 | 否；领域是店铺与交易，不是普通创作者笔记 | 不路由到内容发布能力 |
| 创作服务平台人工操作 | 官方产品 UI | 人工发布、查看本人内容与数据 | 可人工完成，但不能提供自动化 Connector 契约 | 作为故障时的人工 reconcile / handoff |
| `xpzouying/xiaohongshu-mcp` | 非官方开源实现，Apache-2.0 | 本机浏览器登录、图文/视频发布、私密可见性、本人主页、笔记详情和评论 | 可以提供执行原语，但自身发布响应没有笔记 ID | 选为固定、loopback-only sidecar；外层必须补 receipt gate |
| `dreammis/social-auto-upload` | 非官方开源实现 | Python/Playwright 登录与图文/视频上传 | 目标覆盖可达，但私密可见性、receipt、reconcile 与反馈观察尚未完成 conformance | 保持 research route；验证后可成为第二个完整实现候选 |
| `chatek/opencli` | 非官方开源实现 | 登录浏览器 + Browser Bridge，声明支持图文发布、创作者笔记与统计读取 | 控制通道不同，但扩展信任、私密发布、receipt 和防重尚未验证 | 保持 research route；不能因命令存在就视为可用 |
| `RbBtSn0w/omni-post` | 非官方开源实现 | Playwright 多平台上传，含小红书路径 | 当前没有建立本纵切要求的私密发布、稳定 receipt、reconcile 和反馈契约 | 作为 degraded research input，不进入自动选择 |

代码许可证只授权使用开源实现，不等于小红书授权浏览器自动化。真实账号接入必须由账号所有者确认授权与适用条款；不得使用身份池规避风控，不自动评论、点赞、私信或公开发布。

### 2.1 多路由不是盲目 fallback

公开 Capability 仍然只有一个；具体 route 藏在 Connector/Collector 后面。`routes.json` 同时维护四类路径：

1. `full`：目标是完整履行 authorize → submit → reconcile → observe；只有 `verified + healthy` 才能自动选择；
2. `degraded`：只能完成部分流程，例如官方 Share SDK 的 App 交接；
3. `recovery`：人工创作中心，用于异常后的核对或显式接管；
4. `component`：只提供身份等局部能力，例如官方账号 API。

`xiaohongshu-mcp`、`social-auto-upload`、OpenCLI 和 OmniPost 并非四个独立故障域：它们都依赖小红书创作中心及其 DOM。不同运行时只能抵抗自身实现、依赖或浏览器控制通道故障，不能抵抗页面整体改版。2026 年 7 月已有上游 issue 记录发布按钮或编辑器选择器失效，因此路由目录必须显式记录共同的 `creator-center-dom` 故障域。

平台写入采用 sticky route：ledger 在副作用前记录选定 route；只有明确证明 `definitely-not-executed` 才允许换到另一个已验证完整 route。只要结果是 `possibly-executed` 或 `unknown`，自动 fallback 一律禁止，先通过原 route 或人工 recovery route 对账，避免重复发布。

## 3. 选定执行组合

```text
Capability: publish private note and observe
  → validate frozen revision + one-time confirmation
  → inspect owned session
  → snapshot owned-note baseline
  → reserve durable operation ledger entry
  → xiaohongshu-mcp visible-browser private publish
  → poll owned profile for a new exact-title note
  → use current ephemeral xsec token to read detail
  → assert body marker + media count
  → persist stable platform ID/URL receipt
  → reacquire ephemeral token from owned profile
  → read metrics/comments
  → remove commenter identity and internal tokens
  → return receipt + initial observation
```

关键判断：上游目前会确认发布后离开创作表单，这能消除一部分假阳性，但其 `PublishResponse` 仍只有标题、正文、媒体数和“发布完成”，没有笔记 ID。因此本 Connector 不信任上游成功为最终 receipt。

为避免超时后的重复发帖，revision digest 在平台调用前进入持久 ledger。任何提交后异常都进入 `unknown`，后续自动重试被拒绝，必须先人工或平台侧 reconcile。

## 4. 概念图

```text
Xiaohongshu Platform
└── Owned Account Session
    └── owns → Note
        ├── created from → Frozen Note Revision
        ├── evidenced by → Publication Receipt
        └── observed as → Note Observation
            ├── Metric Snapshot
            └── Deidentified Feedback Entry

Publication Attempt
├── consumes → One-time Confirmation
├── compares → Owned-note Baseline
├── produces → confirmed | unknown
└── uses internally → Ephemeral Access Artifact (xsec token)
```

概念边界：

- **Frozen Note Revision**：标题、正文、话题、媒体指纹、私密可见性和验证 marker 的不可变组合；digest 改变即是新 revision。
- **One-time Confirmation**：只授权指定 Capability、revision ID、digest 和有效期，不是账号级永久授权。
- **Publication Receipt**：只有平台侧重新发现并通过详情核对后才成立；上游 HTTP 响应不是 receipt。
- **Note Observation**：某一时间点的指标和评论视图，不代表平台全量或实时真相。
- **Deidentified Feedback Entry**：保留评论 ID、文本与时间，不保留昵称、头像、用户 ID 或跨条目身份关联。
- **Ephemeral Access Artifact**：`xsec_token` 只在当前请求链内使用，不进 knowledge、ledger、receipt 或日志。
- **Owned Account Session**：仓库只保存 opaque identity/credential ref；Cookie 与真实账号信息留在仓库外。

## 5. 候选能力契约

稳定 ID：`xiaohongshu.note.publish-private-and-observe`

种类：operation

effect：platform-write

访问等级：owned

访问方式：browser-assisted

强制前置条件：

1. 显式授权的自有账号；
2. 可见浏览器运行模式；
3. sidecar 仅监听 loopback，且必须使用 Bearer token；
4. revision 已冻结并带唯一正文 marker；
5. 用户对该 revision 做一次性确认；
6. 强制 `仅自己可见`；
7. 本地媒体使用绝对路径。

稳定输出只包含：

- `confirmed` 或 `unknown`；
- revision ID/digest；
- 平台 note ID 与稳定 URL（仅 confirmed）；
- 可审计的检查项；
- 初次指标快照；
- 去身份化评论。

明确不输出：Connector/Collector ID、sidecar URL/token、Cookie、浏览器 profile、`xsec_token`、真实账号身份或评论者身份。

## 6. 维护模型

`xiaohongshu-maintainer` 是 proposal-only Collector，同时维护当前实现与尚在调研的 route：

- 每日检查官方分享、账号、电商和社区规则来源是否可达；
- 对比每个开源 route 的已审阅 commit 与当前分支 HEAD；无法访问、发生漂移都按 route 单独生成 proposal，不静默遗忘研究路径；
- 检查 route lifecycle、契约覆盖缺口、共同故障域与 probe 状态；只有 `verified + full + healthy` 可进入自动选择；
- 检查本机二进制存在性；
- 检查 Connector conformance 与 canonical Capability 是否一致；
- 上游变化只生成“审计后再 repin”的 proposal，不自动升级；
- 失败执行触发 reconcile proposal，不自动重发；
- live probe 永远需要显式批准，Collector 不得自行发布。

官网变更观测分层进行，不能把 HTTP 200 当成“没变化”：

1. **传输层**：URL、状态码、重定向链、TLS/超时；
2. **页面结构层**：文档导航、标题、主内容区域、静态资源版本；SPA 页面必须用浏览器渲染后的 DOM，不能只 hash 空壳 HTML；
3. **语义层**：抽取已审阅事实，例如“Share SDK 是否仍为用户在 App 内完成发布”“账号 API 是否新增笔记接口”；用断言和结构化 snapshot 比较；
4. **能力层**：当语义变化可能改变 Capability 边界时生成 `knowledge-proposal` 和相应 probe 计划；Collector 不直接改 canonical knowledge；
5. **证据层**：保存 URL、观测时间、规范化片段摘要与内容 digest；原始网页快照放受限 staging/object store，不把整页复制进 knowledge。

内容指纹变化只是“需要审阅”，不是事实变化。反过来，即使页面指纹不变，周期性 live probe 失败仍会独立 suspend 路由。官网 source monitor 与行为 probe 必须双轨存在。

确定性入口若遇到 `browser-rendered-semantic` 来源，会生成浏览器观测 proposal；Collector Agent 读取渲染 DOM 后把规范化文本交给同一断言求值器。求值器只返回 digest 与逐条 pass/fail，不让 Agent 自行修改基线或 canonical knowledge。

建议 live verification 新鲜期为 7 天；以下事件立即使能力进入 suspended/review-required：

- 页面选择器或响应形状改变；
- 官方条款或开放能力改变；
- 固定 sidecar commit 变化；
- 登录/本人主页/详情任一步失败；
- 出现 HTTP 成功但本人主页不可见；
- receipt 或反馈结果泄漏内部 token/身份。

## 7. 当前证据与剩余门

已完成：

- 官方四类平台能力边界调研；
- 上游固定 commit 与 Apache-2.0 许可证核验；
- 上游 `go test ./...` 通过；
- 候选 Connector、持久防重 ledger、去身份化反馈和 conformance tests；
- proposal-only Collector 与 live probe 定义。

尚未完成，因此当前完整可用闭环仍是 **0**：

- 当前 sidecar 已构建，用户自有账号扫码登录与只读 doctor 已通过，但这只证明执行环境和本人主页读取可用；
- 创建 opaque probe identity/pool（需要用户确认所有权和授权依据）；
- 冻结私密 probe revision；
- 用户对该 revision 做一次性发布确认；
- 真实发布、本人主页差分、详情核验和初始反馈读取；
- 生成脱敏 VerificationReport；
- 将 Platform、Concept、Capability 和 Schema 从候选提升到 canonical `knowledge/`。

## 8. 来源

- 小红书分享开放平台能力概览：https://agora.xiaohongshu.com/doc/ability
- 小红书分享 SDK 常见问题：https://agora.xiaohongshu.com/doc/qa
- 小红书 JS SDK：https://agora.xiaohongshu.com/doc/js
- 小红书账号开放平台 API：https://openaccount.xiaohongshu.com/docs/api-reference
- 小红书电商开放平台：https://open.xiaohongshu.com/home
- 小红书社区公约 2.0：https://pgy.xiaohongshu.com/help/detail?id=1eda0a065dd894063c2e029a49e8f6a1&userType=4
- `xpzouying/xiaohongshu-mcp`：https://github.com/xpzouying/xiaohongshu-mcp
- `dreammis/social-auto-upload`：https://github.com/dreammis/social-auto-upload
- `chatek/opencli` 小红书适配说明：https://github.com/chatek/opencli/blob/main/docs/adapters/browser/xiaohongshu.md
- `RbBtSn0w/omni-post`：https://github.com/RbBtSn0w/omni-post
- 上游创作中心 DOM 失效实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/725
- 上游编辑器选择器失效实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/780
- 上游假阳性问题实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/625

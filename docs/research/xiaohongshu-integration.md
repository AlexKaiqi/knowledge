# 小红书接入调研与第一条能力纵切

状态：本人笔记读取能力已准入；私密发布纵切仍为实现候选

核验日期：2026-08-27

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
| `CNQQC/xhs-mcp` | 非官方开源实现，Apache-2.0 | 在 `xpzouying` 基线上维护超时、panic、内存与安全验证修复 | 能抵抗部分实现缺陷，但共享代码血缘、Rod runtime 和创作中心 DOM | 维护为 upstream variant，不算独立故障域 |
| `white0dew/XiaohongshuSkills` | 非官方开源实现，MIT | 原生 CDP 发布、发布后 note link 探测、主页读取、详情/评论与创作者内容数据 | 具备 submit/reconcile/observe 原语，但未暴露私密发布，link 探测也尚不是稳定 receipt | 新增 full research route，优先补私密与 receipt conformance |
| `chatek/opencli` | 非官方开源实现 | 登录浏览器 + Browser Bridge，声明支持图文发布、创作者笔记与统计读取 | 控制通道不同，但扩展信任、私密发布、receipt 和防重尚未验证 | 保持 research route；不能因命令存在就视为可用 |
| `jackwener/xiaohongshu-cli` | 非官方开源实现；当前无仓库许可证 | 反向工程签名 API，支持 `--private` 图文发布、本人笔记列表、详情与评论 | 是最有价值的独立故障域候选，但许可证缺失，publish response/receipt 尚未 live 验证 | 新增 blocked research route；只持续观察，不复制、不 vendor、不自动路由 |
| `RbBtSn0w/omni-post` | 非官方开源实现 | Playwright 多平台上传，含小红书路径 | 当前没有建立本纵切要求的私密发布、稳定 receipt、reconcile 和反馈契约 | 作为 degraded research input，不进入自动选择 |

代码许可证只授权使用开源实现，不等于小红书授权浏览器自动化。真实账号接入必须由账号所有者确认授权与适用条款；不得使用身份池规避风控，不自动评论、点赞、私信或公开发布。

### 2.1 多路由不是盲目 fallback

公开 Capability 仍然只有一个；具体 route 藏在 Connector/Collector 后面。`routes.json` 同时维护四类路径：

1. `full`：目标是完整履行 authorize → submit → reconcile → observe；只有 `verified + healthy` 才能自动选择；
2. `degraded`：只能完成部分流程，例如官方 Share SDK 的 App 交接；
3. `recovery`：人工创作中心，用于异常后的核对或显式接管；
4. `component`：只提供身份等局部能力，例如官方账号 API。

`xiaohongshu-mcp`、CNQQC variant、`social-auto-upload`、XiaohongshuSkills、OpenCLI 和 OmniPost 并非六个独立故障域：它们都直接或间接依赖小红书创作中心及其 DOM。不同运行时只能抵抗自身实现、依赖或浏览器控制通道故障，不能抵抗页面整体改版。2026 年 7 月已有上游 issue 记录发布按钮或编辑器选择器失效，因此路由目录必须显式记录共同的 `creator-center-dom` 故障域。`jackwener/xiaohongshu-cli` 的签名 API 才构成不同故障域，但会转而承担内部 API 与签名漂移风险。

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

## 5. 候选发布能力契约

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

此外，`projects.json` 保存经代码与许可证核验的开源生态目录。目前记录 18 个项目，来源关键词包括 `xiaohongshu`、`小红书`、`xhs`、`rednote`、MCP、自动发布、crawler 和 creator analytics。项目按职责分成：

- **Connector candidate**：可能承担发布或观察阶段；只有少数会提升为 route；
- **Collector candidate**：搜索、详情、评论、创作者数据或被动页面观测；
- **Upstream variant**：同一代码血缘的 bugfix 分支，不计算故障域冗余；
- **Evaluation source**：横评与故障样本，只提供研究证据；
- **Blocked / excluded**：缺许可证或目标为 `rednote.com` 等不匹配范围，保留记录以避免反复误选。

重点 Collector 候选包括：OpenWeb 的适配传输与结构化详情/评论、MediaCrawler 的搜索/创作者/评论采集、Apache-2.0 的 `tamnd/xiaohongshu-cli` 签名读取路径、MIT 的被动浏览器采集扩展，以及 `xhs-toolkit` / XiaohongshuSkills 的创作者数据面。MediaCrawler 使用非商业学习许可证，只能作为研究参考，不能因开源可见就进入通用生产依赖。

持续关注规则：高优先级项目 7 天复审，中优先级 14 天，低优先级 30 天。确定性入口每日比较 branch HEAD 并计算复审到期；任一信号生成 proposal 后，再由审阅流程检查 release、issue、license、archived、能力文档和相关代码差异。研究项目变化不会直接把已验证 route 判死，但 route 所绑定的同一 revision 漂移仍是 capability blocker。

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
- 10 条 access route（完整候选、研究、降级、恢复和组件）与 18 项开源生态 watch catalog；
- 7 个 route 上游和 18 个研究项目的独立 HEAD/复审观测；

平台读取闭环已完成：

- 当前 sidecar 已构建，自有账号会话登录有效；
- `listOwnedNotes` live probe 实际读取本人主页并返回 0 条的合法空列表；
- 输出通过产品 Schema，证据只保留条目数量与结构检查；
- 小红书 Platform、本人笔记摘要 Concept、读取 Capability 和 live Verification 已进入 canonical `knowledge/`。

私密发布闭环仍为 **0**，尚未完成：

- 扩展当前 opaque probe identity 对私密发布 Capability 的一次性授权；
- 冻结私密 probe revision；
- 用户对该 revision 做一次性发布确认；
- 真实发布、本人主页差分、详情核验和初始反馈读取；
- 生成脱敏 VerificationReport；
- 将发布相关 Concept、Capability 和 Schema 从候选提升到 canonical `knowledge/`。

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
- `CNQQC/xhs-mcp`：https://github.com/CNQQC/xhs-mcp
- `white0dew/XiaohongshuSkills`：https://github.com/white0dew/XiaohongshuSkills
- `jackwener/xiaohongshu-cli`：https://github.com/jackwener/xiaohongshu-cli
- `aki66938/xhs-toolkit`：https://github.com/aki66938/xhs-toolkit
- OpenWeb 小红书 adapter：https://github.com/imoonkey/openweb/blob/main/src/sites/xiaohongshu/DOC.md
- MediaCrawler 小红书实现：https://github.com/NanmiCoder/MediaCrawler/blob/main/media_platform/xhs/core.py
- `tamnd/xiaohongshu-cli`：https://github.com/tamnd/xiaohongshu-cli
- 小红书采集工具横评：https://github.com/lijiajie-git/xiaohongshu-scraper-bakeoff
- 上游创作中心 DOM 失效实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/725
- 上游编辑器选择器失效实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/780
- 上游假阳性问题实例：https://github.com/xpzouying/xiaohongshu-mcp/issues/625

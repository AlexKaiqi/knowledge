---
type: Capability
title: 执行证据化调研
description: 根据需求、市场/竞品、技术、学术、平台接入或传播场景，生成有来源、反证、置信度、覆盖边界和下一步 probe 的 Research Dossier。
tags: [research, synthesis, evidence, agentic, decision-support]
outcomes: [demand-discovery, product-research, distribution, influence-measurement]
generated: { by: connector:evidence-backed-research-agent, at: 2026-08-27T00:50:01Z }
verified:
  - { by: probe:evidence-backed-research-local-20260827, at: 2026-08-27T11:08:38.181Z }
status: experimental
stale_after: 2026-09-10T11:08:38.181Z
sources:
  - id: subject
    resource: ../../tools/evidence-backed-research.md
    title: 证据化调研
    author: tool:evidence-backed-research
  - id: local-report
    resource: ../../verifications/research/evidence-backed-research/report.json
    title: Local verification report
    author: probe:evidence-backed-research-local
  - id: platform-integration-observation
    resource: ../../verifications/research/evidence-backed-research/platform-integration-snapshot.json
    title: App review provider route research observation
    author: connector:evidence-backed-research-agent
  - id: xianyu-platform-integration-observation
    resource: ../../verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json
    title: Xianyu keyword search route research observation
    author: connector:evidence-backed-research-agent
  - id: demand-source-routes-platform-integration-observation
    resource: ../../verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json
    title: Google, Xianyu, 58 and BOSS demand source route research observation
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-technical-observation
    resource: ../../verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json
    title: Assistant approval technical-solution research observation
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-transport-security-observation
    resource: ../../verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json
    title: Assistant approval transport security research observation
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-demand-observation
    resource: ../../verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json
    title: Personal assistant independent difficulties demand research observation
    author: connector:evidence-backed-research-agent
  - id: assistant-memory-frontier-observation
    resource: ../../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json
    title: Personal assistant memory academic-frontier research observation
    author: connector:evidence-backed-research-agent
  - id: distribution-impact-observation
    resource: ../../verifications/research/evidence-backed-research/distribution-impact-snapshot.json
    title: Game and App distribution-impact research observation
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-market-competitive-observation
    resource: ../../verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json
    title: Personal assistant and pet market-competitive research observation
    author: connector:evidence-backed-research-agent
capability:
  id: research.conduct-evidence-backed
  version: 1.0.0
  subjectRef: /tools/evidence-backed-research.md
  kind: computation
  effect: none
  inputSchema: /schemas/research/conduct-evidence-backed-research-input.schema.json
  outputSchema: /schemas/research/conduct-evidence-backed-research-output.schema.json
  resultConcepts: [/concepts/research/evidence-backed-research-dossier.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: required
access:
  class: public
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只允许读取调用者提供或有权访问的材料与公开来源；私有访谈、评论和运营数据默认不进入持久 dossier。任何登录、付费访问、接受条款、平台写入、身份关系或真实用户研究招募都需要能力外的独立授权。
verification:
  level: local
  report: /verifications/research/evidence-backed-research/report.json
---

# 执行证据化调研

调用者提供一个场景、目标、待做决策和最多六个问题。能力内部收敛研究问题、编译场景证据计划、调用可用的已验证读取能力、主动搜索反证、解释重要冲突，并返回统一 Research Dossier。调用者不需要选择 GitHub、arXiv、浏览器、API、查询词轮换或具体 Connector。

这是一个一级能力，不是若干平台读取能力的文档别名。它的稳定语义是“把有界决策问题转成可审阅的证据结果”；平台、工具、信息源和 Agent 模型都是可替换的隐藏执行依赖。

场景不是报告模板，而是最低证据规则：

- `demand`：用户情境/行为/困难与反证；不从单条功能请求推导普遍需求。
- `market-competitive`：市场口径、独立信号、方案证据和反证；无双方法或明确假设的规模只算 suggestive。
- `technical-solution`：固定版本的实现、benchmark、失败证据与可执行 probe。
- `academic-frontier`：检索截止、纳排范围、论文版本、精确 locator、benchmark 与反证。
- `platform-integration`：官方权限/条款/Schema、独立实现证据与 sandbox/live probe。
- `distribution-impact`：publication、exposure、engagement、feedback、conversion 及归因边界。

场景是同一能力内可发现、可分别验收的 profile；“支持某个场景策略”和“该场景已经过真实 Agent 运行”是两个不同事实：

| 场景 | 不可省略的证据角色 | 当前验证 |
| --- | --- | --- |
| `demand` | problem evidence、counter-evidence | 契约通过；已有个人助理/宠物独立困难真实 Agent 样本 |
| `market-competitive` | market signal、solution evidence、counter-evidence | 契约通过；已有个人助理/AI 陪伴/虚拟宠物品类边界与 persona continuity 下一切片真实 Agent 样本 |
| `technical-solution` | implementation evidence、benchmark、counter-evidence | 契约通过；已有个人助理 approval 架构与 transport security 两次真实 Agent 样本 |
| `academic-frontier` | research claim、benchmark、counter-evidence | 契约通过；已有个人助理长期记忆评测前沿真实 Agent 样本 |
| `platform-integration` | official boundary、implementation evidence、counter-evidence | 契约通过；已有 App 评论、闲鱼单平台与 Google/闲鱼/58/BOSS 路线裁决三个真实 Agent 样本 |
| `distribution-impact` | platform signal、problem evidence、counter-evidence | 契约通过；已有 Steam、App Store Connect 与 Google Play 指标边界真实 Agent 样本 |

外部 Skill、论文方法或研究模板只能作为方法证据进入隐藏实现；只有被映射到上述公共输入/输出、通过场景契约和真实运行后，才能提高该 Research Capability 的验证状态。它们不会因为存在、热门或能安装就自动成为新能力。

当前验证证明了公共 Schema、五个固定上游方法来源、反证与六场景策略。三个 `platform-integration`、两次 `technical-solution`、一次 `demand`、一次 `academic-frontier`、一次 `distribution-impact` 与一次 `market-competitive` 真实运行已经覆盖全部场景。传播样本证明平台原生指标、成熟期、阈值、未归因和 surface coverage 不可伪等价；市场/竞品样本又证明 Apple 公开目录只能作可变候选与 metadata 信号，persona 文件、提示和封闭行为词表只是 solution mechanism，不能冒充长程角色连续性。结合独立 benchmark 与本地能力边界，它选择 effect-free persona continuity evaluator 为下一 probe，并把 trajectory memory、重复率、真实状态与长期陪伴结果拆开。运行没有创建账号、消费 credits、安装第三方项目、执行动作、读取开发者报告或签发授权。这证明能力能提出、拒绝和排序下一能力切片，但没有证明 Agent 对任意问题都研究正确，也没有证明跨 runtime 重复稳定。因此每次结果继续要求人工审阅，`conformance=review-required` 的结果不得支撑产品或平台知识准入。

六个场景共享一个 Capability version。只有场景需要不兼容的输入/结果 Concept、权限/副作用、证据门或独立 eval 生命周期时才拆分；增加一种来源路线不会自动增加公共 Capability。

- [输入 Schema](../../schemas/research/conduct-evidence-backed-research-input.schema.json)
- [输出 Schema](../../schemas/research/conduct-evidence-backed-research-output.schema.json)
- [验证报告](../../verifications/research/evidence-backed-research/report.json)
- [平台接入场景验证样本](../../verifications/research/evidence-backed-research/platform-integration-snapshot.json)
- [闲鱼平台接入场景验证样本](../../verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json)
- [Google/闲鱼/58/BOSS 需求来源路线验证样本](../../verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json)
- [个人助理 approval 技术方案验证样本](../../verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json)
- [个人助理 approval transport security 验证样本](../../verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json)
- [个人助理/宠物独立困难需求验证样本](../../verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json)
- [个人助理长期记忆学术前沿验证样本](../../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json)
- [游戏/App 传播影响验证样本](../../verifications/research/evidence-backed-research/distribution-impact-snapshot.json)
- [个人助理/宠物市场与竞品验证样本](../../verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json)

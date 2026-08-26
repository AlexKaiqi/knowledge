# OKF 知识能力门面、隐藏执行与持续维护内核

状态：架构决策；独立知识仓库、本地准入门和第一个 candidate Connector 已实现，不代表任何外部平台能力已准入

核验日期：2026-08-26

外部基线：`GoogleCloudPlatform/open-knowledge-format@ad30107c31c06aec8a7d5636e0d1058118604e6f`

范围：定义如何直接采用 OKF 表达平台、工具、信息源、概念和能力，如何把 Connector 执行逻辑隐藏在知识能力之后，以及 Collector 如何持续维护 OKF 和 Connector。本文不声明任何新平台已可调用。

## 1. 核心决策

外部使用者接入一个平台、工具或信息源时，只面对知识：

```text
Subject knowledge
Concept knowledge
Capability knowledge
Schema references
Current capability status
```

外部不需要知道：

```text
用了哪个 Connector
Connector 是 API、SDK、CLI、MCP、sidecar 还是浏览器
如何分页、限流、checkpoint、去重和 reconcile
具体凭据、账号绑定和 fallback route
哪个 Collector 在维护知识与执行实现
```

调用模型是：

```text
发现知识
  → 选择 capability
  → 按 capability 声明的 Schema 提交参数
  → 获得结果、Operation 或不可用原因
```

系统内部才执行：

```text
CapabilityRef
  → policy + authorization + health resolution
  → hidden Connector route
  → Observation / Result / Receipt
```

另一条独立的内部闭环持续维护这个产品面：

```text
Collector
  → 观察官方文档、Schema、条款、生态和运行证据
  → 检查 OKF knowledge 与 Connector
  → 生成 KnowledgeProposal / ConnectorChangeProposal / VerificationReport
  → 经过 policy、测试和必要的人审 gate
  → 更新 OKF 或 Connector
```

因此，**Knowledge 是产品表面，Capability 是调用契约，Connector 是隐藏执行内核，Collector 是隐藏维护内核**。

## 2. 直接采用 OKF

本项目是独立 Git repository，直接采用 Open Knowledge Format v0.2；OKF knowledge、Connector 执行、Collector 维护和 probe 控制面共享同一个 Git revision，但只有 `knowledge/` 是外部产品面。

一个 OKF bundle 只是当前仓库中的一个目录：

```text
knowledge/
├── index.md
├── log.md
├── platforms/
├── tools/
├── sources/
├── concepts/
├── capabilities/
├── schemas/
└── references/
```

OKF 的原生语义直接保留：

- 一个 Concept 一个 Markdown 文件；
- YAML frontmatter 保存少量可查询元数据；
- Markdown body 保存解释、例子、边界和逐 claim 证据；
- `sources` 表达 provenance；
- `generated` 与 `verified` 分开；
- `status` 和 `stale_after` 表达生命周期与新鲜度；
- 普通 Markdown link 形成知识图；
- 未知 `type` 和扩展字段可以被宽容消费者保留；
- Git commit、diff、blame 和 review 负责知识历史。

根 `index.md` 可声明：

```yaml
---
okf_version: "0.2"
type: Knowledge Bundle
title: DSH Platform, Tool and Source Knowledge
---
```

当前阶段不增加 `catalog.yaml`、自定义 KnowledgeSnapshot 数据库、Dolt、跨 repo registry 或另一套 proposal 存储。需要固定运行依据时，只记录：

```text
bundle-relative concept path
git commit
document content hash
```

## 3. 知识是唯一公开门面

### 3.1 Subject knowledge

平台、工具和信息源都用普通 OKF Concept 表达。它们可以互相链接，但不要求进入一个统一继承树。

```text
platform: GitHub
tool: Octokit
source: GitHub Issues
protocol: GitHub REST API
dataset: GitHub Archive
```

例如：

```markdown
---
type: Platform
title: GitHub
resource: https://github.com
status: stable
sources:
  - id: official-docs
    resource: https://docs.github.com
    title: GitHub Docs
---

# Concepts

- [Repository](../concepts/github/repository.md)
- [Issue](../concepts/github/issue.md)

# Capabilities

- [Search work items](../capabilities/github/search-work-items.md)
- [Read work item](../capabilities/github/read-work-item.md)
```

### 3.2 Concept knowledge

Concept 文档描述平台或工具中的对象、事件、指标、生命周期和关系，不保存具体实例数据。

```markdown
---
type: Platform Concept
title: GitHub Issue
resource: https://docs.github.com/rest/issues/issues
status: stable
sources: []
---

# Identity

原生身份由 installation/host、repository 和 issue number 共同确定。

# Schema

- Native: [GitHub Issue response schema](../../schemas/github/issue-response.schema.json)

# Lifecycle

open、closed、reopened 与 state reason 分开解释。
```

不同产品不需要共享 Concept Schema。只有确有跨产品查询需求时，才另外建立 canonical concept 或 projection mapping。

### 3.3 Capability knowledge

Capability 本身是 OKF Concept，也是外部调用者看到的稳定产品契约。

```markdown
---
type: Capability
title: Search GitHub work items
description: 在明确 repository 或 organization scope 中搜索调用者有权查看的 issue 和 pull request。
status: stable
stale_after: 2026-11-26T00:00:00Z
resource: dsh-capability://content.search.work-items/v1
tags: [read, search, github]

capability:
  id: content.search.work-items
  version: v1
  kind: query
  effect: none
  input_schema: ../../schemas/github/search-work-items-input.schema.json
  output_schema: ../../schemas/github/search-work-items-output.schema.json
  result_concepts:
    - ../concepts/github/issue.md
    - ../concepts/github/pull-request.md

access:
  classes: [public, authorized]
  methods: [official-api]
  account_required: conditional
  durable_retention: purpose-review-required

sources:
  - id: official-search-api
    resource: https://docs.github.com/rest/search/search
    title: GitHub REST API — Search
---

# Semantics

返回当前调用者授权范围内的匹配结果；结果数、分页完成和平台总体覆盖不是同一概念。

# Known limits

记录 provider result window、搜索索引延迟和权限塑形结果。
```

这里的 `capability` 和 `access` 是 OKF 允许的 producer extension。普通 OKF 消费者可以忽略它们；DSH Capability Gateway 识别并验证这两个扩展。

Capability 文档公开：

- 能做什么；
- 输入和输出 Schema；
- 会返回哪些 Concept；
- read/local-write/platform-write 等 effect；
- public/owned/authorized/partner 等访问等级；
- 已知的访问方式类别；
- 条款、覆盖、限制和 evidence；
- 当前知识是否 verified、deprecated 或 stale。

Capability 文档不公开或不要求调用者选择：

- Connector ID；
- provider 排序；
- credential ref；
- account binding；
- browser profile；
- sidecar 路径；
- fallback 顺序；
- Connector workflow 的 checkpoint；
- 内部 mapping implementation。

## 4. Schema 不统一产品，只统一边界

每个产品可以拥有完全不同的输入、原生响应和领域对象 Schema。这不是缺陷，而是事实。

建议分三层：

### 4.1 产品 Schema

由平台或工具自己的 Concept/Capability 引用：

```text
github/search-work-items-input.schema.json
github/search-work-items-output.schema.json
douyin/search-videos-input.schema.json
douyin/search-videos-output.schema.json
sec/filing.schema.json
gtfs/trip-update.proto
```

可以使用 JSON Schema、OpenAPI、AsyncAPI、Protobuf、Avro 或官方 schema；OKF 只引用，不吸收或重写它们。

### 4.2 少量公共运行 envelope

系统只统一跨产品不可缺少的包装：

```text
CapabilityInvocation
CapabilityOperation
CapabilityResult
Receipt
Error
```

`Observation` 和 `ExecutionTrace` 是内部审计 envelope。Cursor、checkpoint、page token 和 delivery ID 属于 Connector workflow，不进入公共调用契约，除非某个 Capability 的业务语义本身要求调用者控制它们。

例如 Observation：

```json
{
  "schemaVersion": "dsh.observation/v1",
  "capabilityRef": "knowledge/capabilities/github/search-work-items.md",
  "conceptRef": "knowledge/concepts/github/issue.md",
  "payloadSchema": "knowledge/schemas/github/issue-response.schema.json",
  "observedAt": "2026-08-26T10:00:00Z",
  "payload": {}
}
```

`payload` 不进入统一大 Schema；它只由 `payloadSchema` 解释。

### 4.3 可选 canonical projection

跨平台聚合需要时再定义投影：

```text
github.issue
gitlab.issue
discourse.topic
    ↓ versioned mapping
public-software.work-item
```

Projection 是派生视图，不替代原生 Concept 和 payload。

## 5. Capability Gateway：唯一运行入口

外部消费者只需要一个能力门面：

```text
knowledge.list(subject?, type?)
knowledge.get(conceptRef)
knowledge.capabilities(subjectRef)
capability.invoke(capabilityRef, input, context)
capability.getOperation(operationId)
```

`capability.invoke` 的公共输入：

```json
{
  "capabilityRef": "knowledge/capabilities/github/search-work-items.md",
  "input": {},
  "purpose": "research-public-product-problems",
  "scope": "workspace:current"
}
```

公共结果只有三种形态：

```text
completed       → schema-bound result + receipt ref
accepted        → operation ID，用于长任务/持续采集
unavailable     → 结构化原因和用户可采取的 remediation
```

外部结果不包含 Connector 或 Collector 选择细节。管理员诊断面可以读取独立内部 trace，但它不是业务调用契约。

## 6. Connector：隐藏的能力实现

Connector 继续作为内部抽象存在，但不成为外部平台/工具接入 API。

它隔离：

```text
API / SDK / CLI / MCP / browser / sidecar
authentication and credential binding
request construction
pagination and rate limit primitives
long-running operation and subscription workflow
checkpoint, deduplication and reconciliation
provider-native errors
native response parsing
schema mapping
health and retry classification
```

Connector 不等于一段确定性 adapter 代码。它的执行实现可以是：

```text
deterministic   固定代码和协议 adapter
agentic         Agent 按冻结的能力契约使用允许的工具完成操作
hybrid          确定性外壳约束 Agent 的规划、工具调用和结果验证
manual          生成交接包并等待用户提交证据
```

若 Connector 内含 Agent，其模型 route、提示版本、工具白名单、上下文边界、预算、eval 和失败策略属于 ConnectorDefinition。Agent 仍只能实现已发布 Capability，不能在一次调用中自行发明新能力、扩大副作用或直接修改 OKF。

Agent 是否会接触用户数据、结果是否非确定、是否需要人审等外部可感知性质，必须反映在 Capability knowledge 的 access、effect、data handling 和 result semantics 中；具体模型、prompt 和编排实现继续隐藏。

内部最小对象：

```text
ConnectorDefinition
  capability refs
  execution kind: deterministic / agentic / hybrid / manual
  config schema
  credential slots
  typed execution handlers
  optional model/tool/prompt/eval refs
  conformance evidence

ConnectorInstance
  definition/version
  config ref
  account binding ref
  credential refs
  authorization/health
```

Capability Gateway 根据 capability ref、purpose、effect、policy、authorization、health、limits 和 cost 解析内部 route。调用者不指定 Connector。

同一能力可以有多个隐藏实现：

```text
content.search.videos/v1
  ├── official API Connector
  ├── browser-assisted Connector
  ├── authorized export Connector
  └── manual import Connector
```

知识只公开已证实存在的访问方式类别以及边界；具体路由、优先级和 fallback 是运行时配置。

## 7. Collector：隐藏的持续维护者

Collector 不在 capability invocation 的数据路径中。它是持续维护 OKF knowledge 与 Connector 实现的内部控制循环，通常由 Agent 参与，也可以组合确定性 watcher、validator、probe 和测试器。

Collector 维护两类对象：

```text
OKF knowledge
  subject / concept / capability / schema refs
  sources / verification / status / stale_after
  access / effects / limits / known gaps

Connector
  supported capability bindings
  protocol/schema mappings
  auth and config expectations
  prompt/tool/model refs for agentic connectors
  conformance, health and compatibility
```

Collector 的职责包括：

```text
发现新平台、工具、信息源和能力候选
监测官方文档、条款、Schema、SDK、CLI 和开源 artifact 漂移
检查 OKF 链接、来源、freshness、Schema ref 和语义冲突
检查 Connector 是否仍实现其声明的 Capability
运行无副作用 fixture、contract test、safe probe 和 canary
分析运行 receipt、错误分类、覆盖缺口和退化信号
提出 knowledge add/supersede/deprecate/reverify
提出 Connector mapping、prompt、tool、adapter 或配置契约更新
触发 capability degrade/suspend/reverify 建议
```

典型闭环：

```text
schedule / drift signal / failed run / user report
  → Collector gathers bounded evidence
  → deterministic extraction + optional Agent curation
  → KnowledgeProposal and/or ConnectorChangeProposal
  → schema/contract/security/license/eval checks
  → policy or human decision
  → CAS commit OKF and/or deploy Connector revision
  → verification report
```

Collector 可以调用现有 Connector 做只读检查或安全 probe，但不能因为维护目的自动获得更高权限。真实登录、费用、平台写入、数据长期保留和高影响 Connector 更新仍受各自 gate 约束。

### 7.1 CollectorDefinition

CollectorDefinition 是内部维护任务的版本化契约：

```text
scope: 要维护哪些 OKF path、Subject、Capability 和 Connector
triggers: schedule、stale deadline、drift、failure、manual request
evidence sources and allowed tools
agent/model/prompt/eval refs
read/write boundaries
budgets and stop conditions
proposal schemas
verification requirements
approval policy
```

Collector 大多会有 Agent 参与，因为平台知识整理、概念对齐、文档冲突判断和 Connector 修复建议需要语义推理。但 Agent 的产物默认是 proposal，不是已发布知识或已部署执行代码。

### 7.2 Collector 输出

Collector 不直接向普通外部调用者返回采集数据。它产生可审计的维护对象：

```text
KnowledgeProposal
ConnectorChangeProposal
EvidenceRevision
SchemaDiff
DriftReport
ConformanceReport
VerificationReport
CapabilityStatusRecommendation
```

其中 `CapabilityStatusRecommendation` 只是建议；当前 availability 仍由 Capability Gateway 根据已发布知识和已部署 Connector 动态解析。

### 7.3 原“采集编排”放回 Connector

分页、checkpoint、增量同步、webhook、去重、coverage 和 tombstone 是某项能力如何被执行的逻辑，应属于 Connector 内部 workflow 或独立的 execution library，不再称为 Collector。

外部仍只调用：

```text
capability.invoke(capabilityRef, input, context)
```

无论 Connector 内部执行一次请求、长任务、流式订阅、Agent loop 还是多阶段 workflow，都不改变 OKF Capability 契约。

## 8. 能力知识与动态可用性

知识中的 Capability 表达“这个能力是什么以及有哪些证据支持的访问方式”，但不把本机状态写回知识正文。

Capability Gateway 在读取知识后叠加动态状态：

```text
knowledge freshness
+ connector installed/configured
+ authorization and scopes
+ policy for principal/purpose/effect
+ health/rate limit/cost
= EffectiveCapability
```

外部看到的状态投影：

```json
{
  "capabilityRef": "knowledge/capabilities/github/search-work-items.md",
  "state": "available",
  "conditions": [],
  "resolvedAt": "2026-08-26T10:00:00Z",
  "expiresAt": "2026-08-26T10:05:00Z"
}
```

允许的状态：

```text
available
degraded
manual-action-required
blocked
unavailable
unknown
```

不返回内部候选 route。若需要诊断，只返回面向用户的条件，例如“需要登录”“缺少 scope”“知识已过期”“当前来源限流”。

## 9. 权限与副作用

把 Connector 藏起来不能隐藏副作用。Capability knowledge 必须公开 effect：

```text
none
local-write
platform-write
financial
communication
identity/relationship
```

外部调用者不需要理解执行器，但必须理解自己授权的行为。

规则：

- read 能力可以按政策在隐藏 Connector 间 fallback；
- local-write 要说明产生的本地 artifact、retention 和删除方式；
- platform-write 必须 preview、一次性确认和 receipt；
- unknown external result 先 reconcile，不能换 Connector 重试；
- Collector 不得把真实平台写操作包装成维护 probe，也不能借维护权限绕过 capability gate；
- 知识中出现 browser/MCP/CLI 不代表获得更高授权。

## 10. 平台或工具的接入单位

接入一个新平台或工具分两部分，但外部只消费第一部分。

### 10.1 公开知识包

```text
OKF Subject docs
OKF Concept docs
OKF Capability docs
product Schema files
sources/evidence
status/freshness
```

没有实现的资料仍可作为候选知识，但不进入 canonical bundle。已经通过准入的 Capability 若因登录、限流或短期故障暂时不可执行，其动态状态才可为 unavailable 或 manual-action-required；这不等于重新把理论能力当成已接入能力。

### 10.2 隐藏执行绑定

```text
ConnectorDefinition/Instance
optional deterministic/agentic/hybrid execution workflow
policy and credential binding
health probes
conformance fixtures
runtime mapping
```

实现可以独立替换，不改变 Capability 文档路径、ID、输入输出和外部产品表面。

### 10.3 隐藏维护绑定

```text
CollectorDefinition
maintained OKF/Connector scope
schedule and drift triggers
evidence/tool/model/prompt refs
proposal and verification schemas
approval policy
```

Collector 持续检查公开知识包与隐藏执行绑定是否一致，但不进入普通 capability invocation。

## 11. 复杂度隔离规则

为了保持使用简单，必须坚持：

1. 外部不传 Connector ID、Collector ID、provider strategy 或 credential ref。
2. 外部只传 capability ref、schema-bound input、purpose 和 scope。
3. 产品差异留在产品 Schema，不塞进公共 envelope。
4. Connector 的协议差异不泄漏为 capability 参数，除非它改变业务语义。
5. Connector 内部 workflow 的分页、checkpoint、Agent 规划和去重不泄漏给调用者。
6. 动态 availability 是知识的运行投影，不回写 canonical OKF 文档。
7. 诊断 trace 与业务 result 分开；trace 可以包含内部 route，普通调用结果不包含。
8. 没有实现时只保留候选知识和不可用原因，不进入 canonical bundle，也不生成空 Connector 占位。
9. 新 Connector 不要求修改外部 API；新 Collector 只通过受审 proposal 维护 Capability 文档或 Connector。
10. Capability 的语义或输入输出不兼容时发布新版本，而不是让隐藏实现改变含义。

## 12. 245 个 Platform Pack 不是迁移队列

现有研究 Markdown 是候选证据，不应批量转换成 canonical OKF knowledge。只有当某个平台、工具或信息源至少有一项 Capability 被真实 Connector 跑通并通过新鲜 probe 后，才从对应 Pack 中提取这项能力需要的最小知识：

```text
一个 Platform Pack 候选
  → 选择一个高价值 capability
  → 实现隐藏 Connector
  → 用合法身份执行 probe
  → 形成 passed VerificationReport
  → Subject concepts
  → native Concept docs
  → Capability docs
  → product Schema refs
  → access/evidence/freshness
  → 一次 Git review 后准入
```

分别统计：

```text
candidate subjects
probe-ready capabilities
admitted subjects
admitted capabilities
expired/failed capabilities removed from the current admitted view
```

不能再用一个“已接入平台数”混合知识覆盖和运行能力。

Connector 只为优先能力逐个增加。Collector 可以检查候选证据、canonical OKF、候选 Connector 与已部署 Connector，但只能提交 proposal；未通过 probe 的对象不得被 Collector 自动提升。两者都不要求外部接入者理解。

## 13. 当前已实现纵切

- `knowledge/` 是当前仓库内的 canonical OKF bundle，没有嵌套 Git repo；
- `knowledge/references/admission-policy.json` 是机器准入规则；
- `scripts/check-okf-knowledge.mjs` 验证 frontmatter、链接、Schema、orphan、来源、freshness、probe report 和 repo evidence hash；
- `spec/okf-capability-profile.schema.json` 固定公开 Capability 扩展；
- `spec/connector-definition.schema.json` 固定隐藏执行定义；`connectors/` 保存同仓库内的实现、定义和 conformance tests；
- `spec/collector-definition.schema.json` 固定隐藏维护定义，但尚未登记一个虚假的 Collector 实例；
- `spec/probe-identity*.schema.json`、`probe-definition` 与 `probe-report` 固定合规 probe 控制面；
- validator 是内部准入工具，不是公开 Subject/Capability；当前尚无平台能力完成真实 probe，因此 canonical bundle 暂无业务 Subject/Capability；
- `.staging/` 被 Git 忽略，用于未准入候选；运营身份清单和凭据留在仓库外的 Credentials/runtime store，不进入 Git。

## 14. 后续最小实现

### M0：OKF reader 与准入门（准入门已完成）

- 直接读取 OKF v0.2；
- 支持 index、Concept path、frontmatter、sources、status 和 stale_after；
- 保留未知字段；
- 建立全文、type、tag 和 backlink 索引；
- 不执行任何 capability。

### M1：Capability profile（schema 与静态验证已完成）

- 只为 `type: Capability` 验证 `capability` 与 `access` 扩展；
- 校验 input/output Schema path；
- 提供 `knowledge.capabilities(subjectRef)`；
- canonical capability 必须有隐藏实现和新鲜通过报告；只有候选区可以描述尚未实现的理论能力。

### M2：Capability Gateway

- `capability.invoke`；
- opaque operation ID；
- EffectiveCapability 状态投影；
- policy、authorization 和 effect gate；
- 公共结果不暴露 Connector/Collector。

### M3：三个隐藏 Connector 纵切

1. RSS：确定性 pull Connector；
2. GitHub Issues：官方 API Connector，内部处理 pagination/checkpoint；
3. 抖音研究：browser-assisted hybrid Connector，内部处理耦合搜索与评论采集。

三个纵切对外都只呈现 OKF Subject、Capability、Schema 和同一个 Capability Gateway。

### M4：Collector 维护闭环

- 监测 OKF stale deadline、断链、来源和 Schema drift；
- 检查三个 Connector 的 capability binding 与 conformance；
- Agent 只生成 KnowledgeProposal/ConnectorChangeProposal；
- 确定性验证与人审 gate 后再提交知识或部署新 Connector revision；
- 保存 drift、decision 和 verification report。

## 15. 验收标准

- 删除或替换 Connector 后，Capability knowledge 和外部调用契约不变化；
- 调用者不提供 Connector/Collector 信息也能完成调用；
- 同一 Capability 可切换隐藏实现而保持 input/output Schema；
- 不同产品 payload 完全不同，公共 envelope 仍能存储和追溯；
- 没有执行实现或新鲜通过报告的 Capability 不进入 canonical bundle；候选诊断可以解释 unavailable；
- stale knowledge 使动态能力降级，但不改写历史 Observation；
- 外部可以理解副作用、授权和限制，却看不到凭据和内部 route；
- 业务结果与内部诊断 trace 分离；
- 所有 Observation 固定 capability、Concept、payload Schema、时间和 provenance；
- 245 个 Platform Pack 可以继续留作候选证据，不批量污染 canonical knowledge；
- Connector 可以包含 Agent，但调用仍受冻结 Capability Schema、effect 和 policy 约束；
- Collector 可以发现知识或实现漂移，但未经 gate 只能生成 proposal；
- Collector 被停用不影响已发布 OKF 的读取，也不改变 Connector 的现有调用契约；
- Connector 内部分页或长任务不再被误称为 Collector。

## 16. 与现有实现的关系

- `dsh-social-workbench` 当前的 `PlatformConnector` 可以成为 Capability Gateway 后面的兼容执行器，不再作为未来公开产品面。
- 当前 provider、adapter、route、resolution 继续作为内部实现，但从模型和外部接入者界面隐藏。
- 当前 `CollectionPlan`、checkpoint、coverage、Observation 和 typed ports 继续作为 Connector 内部 execution workflow；后续可重命名以避免与维护型 Collector 混淆。
- 新 Collector 负责 OKF 与 Connector 的 drift、proposal、conformance 和 verification 生命周期，不接管 capability invocation。
- 当前 DSH 模型工具可逐步改为“发现能力/调用能力”，而不是暴露特定平台 CLI 或 adapter。
- Channel Pack 消费 Capability knowledge 和 Observation，不直接组合 Connector。

外部参考：

- [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format)
- [Open Knowledge Format v0.2 specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)
- [OKF to Google Cloud Knowledge Catalog connector note](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/connectors/gcp-knowledge-catalog.md)

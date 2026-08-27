# 目标驱动的研究闭环

状态：架构决策；当前只有首个目标研究与初始证据，不代表新 Capability 已准入  
核验日期：2026-08-27

## 1. 决策

平台是手段，不是研究队列。顶层规划单位改为 `GoalResearchProfile`：它描述要改善的用户结果，再把目标拆成工作流、难点和可独立验证的机会，最后才选择 GitHub、arXiv、应用评论、社区或官方平台作为证据路线。

```text
Goal
→ Workflow
→ Difficulty
→ Opportunity
→ Evidence Plan
→ Connector reads
→ Probe / product experiment
→ admitted Knowledge or rejection
```

成功标准不是“接入了多少来源”，而是得到若干可执行判断：这个难点发生在哪个工作流、证据是什么、能否与整套产品解耦、最小实现是什么、如何验证解决了、什么事实会推翻它。

## 2. 五个对象

### Goal

定义目标用户、使用情境、期望结果、成功信号与不可越过的边界。例如“让单一用户长期使用的个人助理/宠物，在不泄露隐私和不越权的前提下，记住上下文、自然交流、可靠行动并持续产生陪伴感”。

### Workflow

用户可观察的完整过程，而不是系统组件：触发、当前步骤、完成条件、失败恢复和频率。例如“用户说‘还是按上次的方式订’，助理找回约束、展示计划、获批后执行并给 receipt”。

### Difficulty

工作流中有证据的失败、摩擦或风险。必须声明证据来源、适用范围和反证；“记忆很重要”“语音要自然”不是 Difficulty。

### Opportunity

可以独立构建和验证的解决单元。它必须通过六个 gate：

1. 直接改善目标下的一个 Workflow completion；
2. 至少有一条一手问题证据，不只是项目宣传；
3. 边界足够小，不要求先完成整个个人助理；
4. 输入、输出、失败与副作用可定义；
5. 有 local/sandbox/live probe 或产品实验；
6. 不依赖我们无法控制的平台政策、网络效应或长期心理结果才能证明基本成立。

结果分为 `independent`、`conditional`、`not-independent`。`conditional` 可以依赖合法账号或模型 route，但必须把依赖写清；`not-independent` 留作研究问题，不进入实现队列。

### EvidenceItem

保存 source-native claim、时间、稳定 ID/URL、证据类型、适用范围和 digest。Agent 的摘要、聚类、重要性和解决建议必须作为 derived fields，不能覆盖来源事实。

## 3. 来源不是等价的

| 来源 | 最擅长证明 | 不能单独证明 |
| --- | --- | --- |
| GitHub issues/discussions | 可复现 bug、实现摩擦、workaround、维护者判断 | 普遍用户需求、市场规模 |
| GitHub repositories/releases | 可运行方案、架构选择、成熟度与维护变化 | 方案真正有效、用户喜欢 |
| arXiv/OpenReview | 被明确形式化的能力缺口、benchmark、方法、实验与限制 | 产品需求、生产可用性、论文结论一定正确 |
| App 评论/社区 | 用户语言、情境、频率线索、后果和替代方案 | 根因、技术可行性、总体代表性 |
| 官方文档/平台数据 | 权限、发布、状态、指标和执行边界 | 用户为什么需要、技术方案是否优 |

一个实现候选至少需要“问题证据 + 可验证方案/基准”。高风险或长期行为判断还需要第二类独立来源。star、citation、下载量和热榜只作为 source-native signals，不是优先级答案。

## 4. GoalResearchProfile 最小结构

在首个研究闭环稳定前只把它作为内部 proposal schema，不放入 canonical `knowledge/`：

```text
id / version / status
goal statement
target users / contexts / exclusions
observable success
workflow facets
research questions
source roles and allowed capabilities
query packs and rotation
evidence budgets / retention / freshness
opportunity gates
stop conditions / counter-evidence
proposal output
```

query 不是全局关键词表。每个 research question 编译为 source-specific query：GitHub 搜 issue/repository/implementation term，arXiv 搜能力、benchmark 和 evaluation term，应用评论搜用户表述和失败后果。查询命中只进入 evidence staging，不能直接变成知识。

## 5. Collector、Connector 与 OKF

```text
GoalResearchProfile
  → agentic Collector chooses bounded questions
  → verified/candidate Connectors read sources
  → Collector normalizes and cross-checks evidence
  → KnowledgeProposal: Workflow / Difficulty / Opportunity
  → approval + implementation/probe
  → OKF exposes only verified knowledge/capability
```

Connector 继续拥有 source wire、分页、限流、checkpoint 和原生 Schema。Collector 继续维护知识和 Connector，并负责 agentic synthesis；它不把普通抓取改名成研究。OKF 外部调用者不需要知道使用了 GitHub 还是 arXiv，只看经过验证的目标、难点、证据和能力。

## 6. 当前执行规则

- 同时只允许一个 active GoalResearchProfile；当前是 `personal-assistant-pet`。
- 每轮最多选择两个 research questions，每个问题有总请求/结果预算和停止条件。
- 新来源必须先说明它补哪种证据缺口；与现有来源重复且不改变决策的，不接入。
- 初始 evidence 可以进调研文档；canonical Difficulty/Opportunity 仍需产品实验或相应 probe。
- Collector 只生成 proposal，不自动安装项目、不采用代码、不创建账号、不接受协议、不执行平台写操作。

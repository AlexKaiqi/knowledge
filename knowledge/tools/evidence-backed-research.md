---
type: Tool
title: 证据化调研
description: 将不同场景的决策问题转成有来源、反证、边界、置信度和下一步 probe 的 Research Dossier。
tags: [research, evidence, decision, demand, market, technical, academic, platform, distribution]
generated: { by: connector:evidence-backed-research-agent, at: 2026-08-27T00:50:01Z }
verified:
  - { by: probe:evidence-backed-research-local-20260827, at: 2026-08-27T11:08:38.181Z }
status: experimental
stale_after: 2026-09-10T11:08:38.181Z
sources:
  - id: deep-research
    resource: https://github.com/arjunprabhulal/agent-skills/blob/42dd24080fce6d731d00e2a1134f398c3da4171b/skills/research/deep-research/SKILL.md
    title: deep-research SKILL.md
    author: person:arjun-prabhulal
  - id: literature-review
    resource: https://github.com/msimchowitz/writing-skills/blob/214981fe02326f27b0fc8790d00eb4b731607073/for-agents/literature-review/SKILL.md
    title: literature-review SKILL.md
    author: person:max-simchowitz
  - id: interview-to-jtbd
    resource: https://github.com/lowwwbank/interview-to-jtbd/blob/810e847b7d936a54bd090c4d0797efd576404152/SKILL.md
    title: interview-to-jtbd SKILL.md
    author: organization:lowwwbank
  - id: market-researcher
    resource: https://github.com/xcrrr/claude-skills/blob/145342ceff6318d2f5ffe8f95473fecc8b27d1e9/skills/business/market-researcher/SKILL.md
    title: market-researcher SKILL.md
    author: person:adam-parszewski
  - id: research-router
    resource: https://github.com/openai/plugins/blob/33bd9529725fcee78c9e51fcbaa93cd963c3a47b/plugins/life-science-research/skills/research-router-skill/SKILL.md
    title: research-router SKILL.md
    author: organization:openai
  - id: local-verification
    resource: ../verifications/research/evidence-backed-research/report.json
    title: Evidence-backed research local verification
    author: probe:evidence-backed-research-local
  - id: platform-integration-observation
    resource: ../verifications/research/evidence-backed-research/platform-integration-snapshot.json
    title: App review route platform-integration Agent observation
    author: connector:evidence-backed-research-agent
  - id: xianyu-platform-integration-observation
    resource: ../verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json
    title: Xianyu route platform-integration Agent observation
    author: connector:evidence-backed-research-agent
  - id: demand-source-routes-platform-integration-observation
    resource: ../verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json
    title: Google, Xianyu, 58 and BOSS demand source route Agent observation
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-technical-observation
    resource: ../verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json
    title: Assistant approval technical-solution Agent observation
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-transport-security-observation
    resource: ../verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json
    title: Assistant approval transport security Agent observation
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-demand-observation
    resource: ../verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json
    title: Personal assistant independent difficulties demand Agent observation
    author: connector:evidence-backed-research-agent
  - id: assistant-memory-frontier-observation
    resource: ../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json
    title: Personal assistant memory academic-frontier Agent observation
    author: connector:evidence-backed-research-agent
  - id: distribution-impact-observation
    resource: ../verifications/research/evidence-backed-research/distribution-impact-snapshot.json
    title: Game and App distribution-impact Agent observation
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-market-competitive-observation
    resource: ../verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json
    title: Personal assistant and pet market-competitive Agent observation
    author: connector:evidence-backed-research-agent
---

# 证据化调研

这是一个面向决策的本地 Agent 工具，不是搜索引擎包装、链接堆积器或自动生成报告模板。调用者只声明研究场景、目标、要做的决策和问题；内部按场景选择最少的来源能力、执行反方搜索、保存来源原生 claim，并输出统一的 Research Dossier。

当前支持六个场景：需求、市场/竞品、技术方案、学术前沿、平台接入、传播/影响力。它们共享问题收敛、来源加权、冲突处理和反证规则，但保留不同证据门：例如需求研究必须追溯用户材料，学术研究必须声明 cutoff 与论文 locator，平台接入必须同时有官方边界和可执行 probe，传播研究必须分开 publication、exposure、engagement 与 conversion。

上游方法均固定到已逐文件检查的 Git commit，并以 MIT 许可的方法来源吸收；运行时不安装或依赖这些仓库。当前 local probe 验证了五份上游方法证据、六个场景策略和隐藏执行边界；三次 `platform-integration`、两次 `technical-solution`，以及 `demand`、`academic-frontier`、`distribution-impact`、`market-competitive` 各一次真实运行已覆盖六类场景。最新市场/竞品样本交叉读取三个 Apple US/iPhone metadata 小页、两个固定 GitHub 实现、ANCHOR 长程审计和本地能力边界：它拒绝市场规模、稳定排名与 companion quality 总分，选择逐轴、保留 evaluator provenance 的 effect-free persona continuity eval。ANCHOR 为 CC BY-NC 4.0，仅作为测量边界引用，没有复制数据或吸收运行时。同一 Agent/runtime 的重复稳定性仍未证明，因此状态保持 `experimental`。

- [执行证据化调研](../capabilities/research/conduct-evidence-backed-research.md)
- [Research Dossier](../concepts/research/evidence-backed-research-dossier.md)

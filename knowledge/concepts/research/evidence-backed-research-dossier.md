---
type: Concept
title: 证据化 Research Dossier
description: 一次有界调研的决策结论、source-native 证据、反证、冲突、未知项、覆盖边界与下一步 probe。
tags: [research, dossier, evidence, confidence, counter-evidence, probe]
generated: { by: connector:evidence-backed-research-agent, at: 2026-08-27T00:50:01Z }
verified:
  - { by: probe:evidence-backed-research-local-20260827, at: 2026-08-27T11:08:38.181Z }
status: experimental
stale_after: 2026-09-10T11:08:38.181Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/research/evidence-backed-research/snapshot.json
    title: Verified evidence-backed research dossier
    author: connector:evidence-backed-research-agent
  - id: platform-integration-snapshot
    resource: ../../verifications/research/evidence-backed-research/platform-integration-snapshot.json
    title: Verified platform-integration research dossier
    author: connector:evidence-backed-research-agent
  - id: xianyu-platform-integration-snapshot
    resource: ../../verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json
    title: Verified Xianyu platform-integration research dossier
    author: connector:evidence-backed-research-agent
  - id: demand-source-routes-platform-integration-snapshot
    resource: ../../verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json
    title: Verified Google, Xianyu, 58 and BOSS demand source route research dossier
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-technical-snapshot
    resource: ../../verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json
    title: Verified assistant approval technical-solution research dossier
    author: connector:evidence-backed-research-agent
  - id: assistant-approval-transport-security-snapshot
    resource: ../../verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json
    title: Verified assistant approval transport security research dossier
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-demand-snapshot
    resource: ../../verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json
    title: Verified personal assistant independent difficulties demand dossier
    author: connector:evidence-backed-research-agent
  - id: assistant-memory-frontier-snapshot
    resource: ../../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json
    title: Verified personal assistant memory academic-frontier dossier
    author: connector:evidence-backed-research-agent
  - id: distribution-impact-snapshot
    resource: ../../verifications/research/evidence-backed-research/distribution-impact-snapshot.json
    title: Verified game and App distribution-impact dossier
    author: connector:evidence-backed-research-agent
  - id: personal-assistant-market-competitive-snapshot
    resource: ../../verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json
    title: Verified personal assistant and pet market-competitive dossier
    author: connector:evidence-backed-research-agent
---

# 证据化 Research Dossier

Research Dossier 是一次研究运行的公共结果，不是长期事实库。它把来源原生 EvidenceItem 与 Agent 生成的 finding 分开：EvidenceItem 保留来源角色、类型、权重、稳定 URL、精确 locator、观测时间与内容 digest；finding 声明支持度、置信度、引用、反证、适用范围以及是否为推断。

`coverage.complete` 只表示调用声明的场景证据角色已经覆盖且当前问题达到停止条件，不代表互联网、GitHub、论文库、应用评论或市场的完整枚举。`confidence` 反映当前证据质量和覆盖，不是结论永远正确的概率。

每个 dossier 必须保存显式反证检索、重要冲突及解释、无法填补的缺口和至少一个可执行 next probe。只有 probe/实验通过后，其中的产品 Difficulty、Opportunity 或平台 Capability 才能另行申请进入 canonical knowledge；研究结论本身不会自动修改 OKF。

- [输出 Schema](../../schemas/research/conduct-evidence-backed-research-output.schema.json)
- [验证样本](../../verifications/research/evidence-backed-research/snapshot.json)
- [平台接入场景样本](../../verifications/research/evidence-backed-research/platform-integration-snapshot.json)
- [闲鱼平台接入场景样本](../../verifications/research/evidence-backed-research/xianyu-platform-integration-snapshot.json)
- [Google/闲鱼/58/BOSS 需求来源路线样本](../../verifications/research/evidence-backed-research/demand-source-routes-platform-integration-snapshot.json)
- [个人助理 approval 技术方案样本](../../verifications/research/evidence-backed-research/assistant-approval-technical-snapshot.json)
- [个人助理 approval transport security 样本](../../verifications/research/evidence-backed-research/assistant-approval-transport-security-snapshot.json)
- [个人助理/宠物独立困难需求样本](../../verifications/research/evidence-backed-research/personal-assistant-demand-snapshot.json)
- [个人助理长期记忆学术前沿样本](../../verifications/research/evidence-backed-research/assistant-memory-frontier-snapshot.json)
- [游戏/App 传播影响样本](../../verifications/research/evidence-backed-research/distribution-impact-snapshot.json)
- [个人助理/宠物市场与竞品样本](../../verifications/research/evidence-backed-research/personal-assistant-market-competitive-snapshot.json)

---
type: Tool
title: 传播影响观察评测器
description: 对去身份化、source-native 的 baseline/current 观察执行定义、scope、窗口、成熟度和归因边界检查。
tags: [distribution, impact, analytics, attribution, finalization, privacy, deterministic]
generated: { by: connector:distribution-impact-observation-evaluator, at: 2026-08-27T07:50:32Z }
verified:
  - { by: probe:distribution-impact-observation-evaluation-local-20260827, at: 2026-08-27T07:50:32Z }
status: experimental
stale_after: 2026-09-10T07:50:32Z
sources:
  - id: research-dossier
    resource: ../verifications/research/evidence-backed-research/distribution-impact-snapshot.json
    title: Game and App distribution-impact Research Dossier
    author: connector:evidence-backed-research-agent
  - id: local-verification
    resource: ../verifications/distribution/impact-observation-evaluation/report.json
    title: Distribution impact observation evaluation local verification
    author: probe:distribution-impact-observation-evaluation-local
---

# 传播影响观察评测器

工具不登录 Steam、App Store Connect 或 Google Play，也不读取开发者报告。调用者提交已经取得、去身份化并冻结的原生计数观察；工具只在 source、platform、surface、native metric、definition、scope、unit、窗口长度和成熟度真正可比时计算绝对 delta。

`suppressed`、`unavailable` 和 `not-finalized` 不等于零。平台指标定义变化会单列 `definition-drift`。归因只输出 `platform-attributed`、`temporal-association` 或 `unknown`；时间关联明确不建立因果。

- [能力](../capabilities/distribution/evaluate-impact-observation-set.md)
- [评测结果概念](../concepts/distribution/impact-observation-evaluation.md)

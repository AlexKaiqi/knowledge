---
type: Concept
title: Distribution Impact Observation Evaluation
description: 保留平台原生定义、成熟度、抑制与归因边界的传播影响观察比较结果。
tags: [distribution, impact, native-metric, finalization, attribution, uncertainty]
generated: { by: connector:distribution-impact-observation-evaluator, at: 2026-08-27T07:50:32Z }
verified:
  - { by: probe:distribution-impact-observation-evaluation-local-20260827, at: 2026-08-27T07:50:32Z }
status: experimental
stale_after: 2026-09-10T07:50:32Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/distribution/impact-observation-evaluation/snapshot.json
    title: Verified native distribution impact observation comparisons
    author: connector:distribution-impact-observation-evaluator
---

# Distribution Impact Observation Evaluation

每个 comparison 绑定一个平台、数据源、surface、native metric、definition revision/digest、scope digest、unit 和等长 baseline/current 窗口。只有两侧均为完整、已最终化的 `observed` 计数且定义不变时才产生 delta。

- `platform-attributed`：平台原生归因 evidence 与精确 PublicationReceipt 同时存在；仍只是平台的归因模型，不是受控因果实验。
- `temporal-association`：窗口位于发布前后，但没有平台归因；必须附带 `causality-not-established`。
- `unknown`：没有归因，或观察被抑制、不可用、不完整、scope 不同。
- `pending`：平台声明数据尚未最终化。
- `definition-drift`：平台在两窗之间改变了指标定义，禁止直接比较。

结果不包含跨平台总分，不读取平台、不写知识、不执行动作，也不产生授权。

- [输出 Schema](../../schemas/distribution/evaluate-impact-observation-set-output.schema.json)
- [验证快照](../../verifications/distribution/impact-observation-evaluation/snapshot.json)

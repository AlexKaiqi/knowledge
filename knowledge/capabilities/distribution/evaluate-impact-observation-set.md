---
type: Capability
title: 评测传播影响观察集
description: 在不读取平台的前提下，比较冻结的 source-native 传播影响观察，并保留成熟度、抑制、定义漂移和归因未知性。
tags: [distribution, impact, analytics, attribution, evaluation, uncertainty]
outcomes: [distribution, influence-measurement, feedback-collection]
generated: { by: connector:distribution-impact-observation-evaluator, at: 2026-08-27T07:50:32Z }
verified:
  - { by: probe:distribution-impact-observation-evaluation-local-20260827, at: 2026-08-27T07:50:32Z }
status: experimental
stale_after: 2026-09-10T07:50:32Z
sources:
  - id: subject
    resource: ../../tools/distribution-impact-observation-evaluator.md
    title: 传播影响观察评测器
    author: tool:distribution-impact-observation-evaluator
  - id: steam-utm
    resource: https://partner.steamgames.com/doc/marketing/utm_analytics
    title: Steamworks UTM Analytics
    author: organization:valve
  - id: apple-campaign
    resource: https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links
    title: App Store Connect campaign links
    author: organization:apple
  - id: apple-reports
    resource: https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api
    title: App Store Connect Analytics Reports API
    author: organization:apple
  - id: google-play-performance
    resource: https://support.google.com/googleplay/android-developer/answer/9859173?hl=en
    title: Google Play store listing performance
    author: organization:google
  - id: local-report
    resource: ../../verifications/distribution/impact-observation-evaluation/report.json
    title: Distribution impact observation evaluation local verification
    author: probe:distribution-impact-observation-evaluation-local
capability:
  id: distribution.evaluate-impact-observation-set
  version: 1.0.0
  subjectRef: /tools/distribution-impact-observation-evaluator.md
  kind: computation
  effect: none
  inputSchema: /schemas/distribution/evaluate-impact-observation-set-input.schema.json
  outputSchema: /schemas/distribution/evaluate-impact-observation-set-output.schema.json
  resultConcepts: [/concepts/distribution/impact-observation-evaluation.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只允许 opaque refs、平台枚举、原生定义/范围摘要、计数、时间窗、成熟度和归因 evidence refs。能力不接收用户级数据、开发者账号、内部 route、评论文本或收入明细；不读取平台、不写知识、不执行动作、不建立因果，也不产生授权。
verification:
  level: local
  report: /verifications/distribution/impact-observation-evaluation/report.json
---

# 评测传播影响观察集

调用者提供一个冻结的 Publication Revision、可选精确 PublicationReceipt，以及最多 50 组 baseline/current 原生计数观察。能力不会把 Steam visit、Apple download 和 Google Play click 映射成同一指标；每组 comparison 必须保持同平台、同 source。

可比较 delta 还要求相同的 surface、native metric、definition、scope、unit，等长且不重叠的窗口，以及两侧完整、已最终化的 observed value。其它情况分别成为 `pending`、`unknown` 或 `definition-drift`，不会用零补齐。

平台归因需要 receipt 和平台 evidence；只有前后时间对齐时只返回 `temporal-association` 并明确否认因果；无归因保持 `unknown`。输出永远固定 `noCrossPlatformScore=true`、`causalClaimGenerated=false`、`platformDataRead=false`、`knowledgeWritten=false`、`actionExecuted=false`、`executionAuthorized=false`。

local probe 覆盖 Steam 精确 UTM 归因、Steam 时间关联、Apple 阈值抑制、Apple 未最终化、Google Play 2026-07 定义漂移与 Not attributed 六组案例，并验证 scope mutation、缺失 receipt、跨平台比较拒绝和稳定重放。这只证明评测器行为，不证明已经读取任何自有平台数据。

- [输入 Schema](../../schemas/distribution/evaluate-impact-observation-set-input.schema.json)
- [输出 Schema](../../schemas/distribution/evaluate-impact-observation-set-output.schema.json)
- [验证报告](../../verifications/distribution/impact-observation-evaluation/report.json)

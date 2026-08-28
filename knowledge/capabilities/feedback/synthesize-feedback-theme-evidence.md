---
type: Capability
title: 归纳反馈主题证据
description: 从有界、去身份化反馈样本归纳带支持证据、反例、冲突、缺口和可执行验证建议的主题集合，固定要求人工审阅。
tags: [feedback, synthesis, themes, evidence, counterexample, experiment]
outcomes: [feedback-collection, product-research]
generated: { by: connector:feedback-theme-synthesis-agent, at: 2026-08-27T02:43:34Z }
verified:
  - { by: probe:feedback-theme-synthesis-local-20260827, at: 2026-08-27T02:43:34Z }
status: experimental
stale_after: 2026-09-10T02:43:34Z
sources:
  - id: subject
    resource: ../../tools/feedback-theme-synthesis.md
    title: 反馈主题证据归纳器
    author: tool:feedback-theme-synthesis
  - id: production-review-contract
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/spec/hypothesis-review.schema.json
    title: dsh-social-workbench hypothesis review contract
    author: organization:alex-kaiqi
  - id: local-report
    resource: ../../verifications/feedback/theme-synthesis/report.json
    title: Local verification report
    author: probe:feedback-theme-synthesis-local
capability:
  id: feedback.synthesize-feedback-theme-evidence
  version: 1.0.0
  subjectRef: /tools/feedback-theme-synthesis.md
  kind: computation
  effect: none
  inputSchema: /schemas/feedback/synthesize-feedback-theme-evidence-input.schema.json
  outputSchema: /schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json
  resultConcepts: [/concepts/feedback/feedback-theme-evidence.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: required
access:
  class: public
  methods: [agent-runtime]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 输入必须由调用者授权并预先去身份化；私有支持记录、访谈与评论受各自 retention/consent 约束。能力不访问平台、不建立身份图谱、不回复用户、不创建 issue、不修改 roadmap 或发布。
verification:
  level: local
  report: /verifications/feedback/theme-synthesis/report.json
---

# 归纳反馈主题证据

输入指定要支持的决策、目标对象、观察时间窗、样本完整性、来源引用和最多 100 项反馈 evidence。每项包含去身份化 statement、内容摘要、证据类型、观察时间和可选 target revision ref；作者、用户名、头像、邮箱和跨平台身份不属于输入。

内部 Agent 提出候选主题，规范化层重新验证所有 evidence refs、计算样本内支持数、派生受影响 revision、保留 unassigned evidence，并固定人审/非执行声明。每个主题至少有一项支持证据，且必须声明 counterevidence refs；冲突不能靠平均或多数票消除。

本地 probe 使用一个包含问题、workaround、反例和无关请求的合成样本，证明支持/反例引用、冲突、未分配证据、样本内计数、输出 Schema 和非执行边界。真实 Agent L3 质量被明确 `skipped`；因此当前状态为 experimental，任何主题都不能直接成为需求优先级或产品承诺。

- [输入 Schema](../../schemas/feedback/synthesize-feedback-theme-evidence-input.schema.json)
- [输出 Schema](../../schemas/feedback/synthesize-feedback-theme-evidence-output.schema.json)
- [验证报告](../../verifications/feedback/theme-synthesis/report.json)

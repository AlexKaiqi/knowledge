---
type: Capability
title: 准备 Steam Early Access 审阅 Revision
description: 将 Steam Early Access 六项 Q&A、当前可玩 build、非绑定未来计划、价格与第三方披露证据冻结为确定性待人审 Revision。
tags: [steam, game-publishing, early-access, questionnaire, pricing, community-feedback, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-early-access-revision, at: 2026-08-27T09:08:48.192Z }
verified:
  - { by: probe:steam-early-access-review-revision-local-20260827, at: 2026-08-27T09:08:48.192Z }
status: stable
stale_after: 2026-09-26T09:08:48.192Z
sources:
  - id: subject
    resource: ../../tools/steam-early-access-revision.md
    title: Steam Early Access Revision 准备器
    author: tool:steam-early-access-revision
  - id: official-early-access
    resource: https://partner.steamgames.com/doc/store/earlyaccess?language=english
    title: Steam Early Access
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: official-page
    resource: https://partner.steamgames.com/doc/store/page?language=english
    title: Steam Store Page Building and Editing
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/early-access-review-revision/report.json
    title: Steam Early Access review revision local verification
    author: probe:steam-early-access-review-revision-local
capability:
  id: steam.prepare-early-access-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-early-access-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-early-access-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-early-access-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/early-access-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只适用于调用者明确选择 Steam Early Access 的自有游戏。输入含公开答卷草稿和 opaque build/feature/limitation/price/evidence refs；结果不验证 build、价格或声明，不保存/发布商店页、不送审、不发布 Early Access，也不授权执行。真实 Steamworks 操作必须由目标 App 的授权用户另行完成。
verification:
  level: local
  report: /verifications/steam/early-access-review-revision/report.json
---

# 准备 Steam Early Access 审阅 Revision

Steam 将 Early Access 定义为仍在开发、但购买时已经可玩且值得当前价格的 alpha/beta 产品。它不是众筹、预购或仅做最终 bug 测试的渠道；客户应根据当前状态购买，不能被要求押注确定的未来承诺。

本能力冻结当前官方公开的六项 Q&A：为什么使用 Early Access、预计持续时间、完整版本计划差异、当前状态、前后价格计划、如何让社区参与。每项答案必须绑定证据，并同时绑定当前 build 可玩证据、gameplay trailer、当前功能/限制、开发/资金/未来承诺/社区影响状态、价格 revision/跨服务比较，以及第三方 Steam key 站点披露。

缺答案、不可玩或未知 build、已经完成开发、依赖 Early Access 销售才能完成、具体未来保证、社区无法影响开发、Steam 价格高于其它服务、跨服务价格或第三方披露证据缺失都会阻断。结构通过也不证明答案真实、build 值得售价、预告片代表当前状态或社区计划可执行。

当前官方 Early Access 页面同时出现“可选择计划 1.0 日期”和“没有专门字段”的冲突说明，因此本能力不暴露独立 1.0 日期字段；只保留 Q&A 中的预计时间文本，并要求人工核对当前后台。

能力不保存、发布、送审或释放产品，也不声称已启用 Early Access。

- [输入 Schema](../../schemas/steam/prepare-early-access-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-early-access-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/early-access-review-revision/report.json)

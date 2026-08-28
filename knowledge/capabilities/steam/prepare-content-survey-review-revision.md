---
type: Capability
title: 准备 Steam Content Survey 审阅 Revision
description: 将观察到的 Steam 问卷版本、三类完整答卷、当前 build/store 声明及生成式 AI 证据冻结为确定性待人审 Revision。
tags: [steam, game-publishing, content-survey, age-rating, mature-content, generative-ai, review-revision]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-content-survey-revision, at: 2026-08-27T08:55:07.313Z }
verified:
  - { by: probe:steam-content-survey-review-revision-local-20260827, at: 2026-08-27T08:55:07.313Z }
status: stable
stale_after: 2026-09-26T08:55:07.313Z
sources:
  - id: subject
    resource: ../../tools/steam-content-survey-revision.md
    title: Steam Content Survey Revision 准备器
    author: tool:steam-content-survey-revision
  - id: official-survey
    resource: https://partner.steamgames.com/doc/gettingstarted/contentsurvey?language=english
    title: Steam Content Survey
    author: organization:valve
  - id: official-germany-rating
    resource: https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany?language=english
    title: Age Ratings Mandatory in Germany
    author: organization:valve
  - id: official-review
    resource: https://partner.steamgames.com/doc/store/review_process?language=english
    title: Steam Store Review Process
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/content-survey-review-revision/report.json
    title: Steam Content Survey review revision local verification
    author: probe:steam-content-survey-review-revision-local
capability:
  id: steam.prepare-content-survey-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-content-survey-revision.md
  kind: computation
  effect: none
  inputSchema: /schemas/steam/prepare-content-survey-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-content-survey-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/content-survey-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 输入只含 opaque game/source/build/question/evidence/content refs 与调用者拟提交的答案。结果不登录 Steamworks、不证明问卷仍是当前版本、不验证答案真实性、不提交问卷、不签发分级、不改变地区可见性、不送审、不发布，也不授权执行；这些动作必须由目标 App 的授权提交者另行完成。
verification:
  level: local
  report: /verifications/steam/content-survey-review-revision/report.json
---

# 准备 Steam Content Survey 审阅 Revision

Steam 官方要求在提交商店页和产品 build 审核前完成 Content Survey；General Content、Mature Content、Generative Artificial Intelligence Content 三部分都必须完成。所有已上传 build 中的成人内容都必须披露，即使玩家暂时无法访问；运行时生成 AI 还需要说明防止非法内容的 guardrail。

Steam 的具体问卷会变化，本能力不复制或声称掌握当前题库。调用者提供 `questionnaireRevisionRef`，并为每部分声明当次观察到的完整 `expectedQuestionRefs`。Revision 要求每道题恰有一个带 evidence/content refs 的答案，同时绑定 `sourceRevisionRef`、`buildRevisionRef`、成人内容完整披露声明、build/store 一致性声明，以及 pre-generated/live-generated AI 的内容、权利和 guardrail 证据。

缺题、多题、重复题、缺必需部分、未确认披露、AI mode 与证据冲突都会阻断。结构通过后，当前问卷映射、答案真实性、所有隐藏内容、权利合法性、guardrail 充分性、分级结果和提交者权限仍全部 pending。

本能力只准备 exact review revision。它不保证德国或其它地区可见，不把本地 fixture 冒充已获评级，也不执行保存、提交、送审或发布。

- [输入 Schema](../../schemas/steam/prepare-content-survey-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-content-survey-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/content-survey-review-revision/report.json)

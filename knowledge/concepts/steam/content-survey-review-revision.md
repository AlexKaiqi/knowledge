---
type: Concept
title: Steam Content Survey Review Revision
description: 将游戏、当前 build、观察到的问卷版本、完整答卷、内容声明与生成式 AI 证据绑定为内容寻址、待人审且不可执行的 revision。
tags: [steam, content-survey, questionnaire-revision, age-rating, mature-content, generative-ai, review-revision]
generated: { by: connector:steam-content-survey-revision, at: 2026-08-27T08:55:07.313Z }
verified:
  - { by: probe:steam-content-survey-review-revision-local-20260827, at: 2026-08-27T08:55:07.313Z }
status: stable
stale_after: 2026-09-26T08:55:07.313Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/content-survey-review-revision/snapshot.json
    title: Verified owned-game Content Survey review revision fixture
    author: connector:steam-content-survey-revision
---

# Steam Content Survey Review Revision

Revision 的 identity 包含游戏、设计源、当前 build、观察到的 Steam 问卷 revision、三部分各自的预期问题集合与完整答案、逐答案 evidence/content refs、成人内容和 build/store 一致性声明，以及 AI mode、交付内容、运行时内容、权利和 guardrail 证据。`preparedAt` 不参与 identity。

`expectedQuestionRefs` 是调用者对某个已观察问卷 revision 的封闭集合，不是本目录宣称的官方题库。这样既能检测漏答、额外答案和重复答案，又不会让持续变化的平台问卷成为静态 Schema。题目和选项 ref 只承担 identity；真实含义、映射与答案真实性必须由提交者复核。

输出固定 `platformValidated=false`、`buildValidatedByConnector=false`、`submittedToSteamworks=false`、`ratingIssued=false`、`storefrontVisibilityChanged=false`、`markedReadyForReview=false`、`released=false`、`executionAuthorized=false`。地区分级和可见性是后续平台结果，不由 revision 推导。

- [输出 Schema](../../schemas/steam/prepare-content-survey-review-revision-output.schema.json)
- [验证快照](../../verifications/steam/content-survey-review-revision/snapshot.json)

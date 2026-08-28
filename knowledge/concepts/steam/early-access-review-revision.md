---
type: Concept
title: Steam Early Access Review Revision
description: 将自有游戏、当前可玩 build、六项 Q&A、资格状态、价格计划和第三方披露绑定为内容寻址、待人审且不可执行的 Early Access revision。
tags: [steam, early-access, questionnaire, build-consistency, pricing, disclosure, review-revision]
generated: { by: connector:steam-early-access-revision, at: 2026-08-27T09:08:48.192Z }
verified:
  - { by: probe:steam-early-access-review-revision-local-20260827, at: 2026-08-27T09:08:48.192Z }
status: stable
stale_after: 2026-09-26T09:08:48.192Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/early-access-review-revision/snapshot.json
    title: Verified owned-game Early Access review revision fixture
    author: connector:steam-early-access-revision
---

# Steam Early Access Review Revision

Revision identity 包含游戏、设计源、当前 build、观察到的 Q&A revision、六项按官方顺序排列的答案及证据、可玩/预告片/当前功能/限制证据、开发和资金资格、未来计划承诺状态、社区参与、价格 revision/方向/跨服务比较，以及第三方 Steam key 分发披露。`preparedAt` 不参与 identity。

它把“现在能买到什么”与“未来可能增加什么”分开。未来计划只能标记为 `non-binding-and-changeable`；当前可玩 build、开发未完成、非销量依赖、社区实质参与和 Steam 价格不高于其它服务都是结构 gate，但 caller 声明仍必须人审。

输出固定 `platformValidated=false`、`buildValidatedByConnector=false`、`priceValidated=false`、`savedToSteamworks=false`、`published=false`、`markedReadyForReview=false`、`releasedAsEarlyAccess=false`、`executionAuthorized=false`。它不是 Steam checklist、批准或 release receipt。

- [输出 Schema](../../schemas/steam/prepare-early-access-review-revision-output.schema.json)
- [验证快照](../../verifications/steam/early-access-review-revision/snapshot.json)

---
type: Tool
title: Steam Content Survey Revision 准备器
description: 将版本化 Steam Content Survey 完整答卷与 build、内容和生成式 AI 证据冻结为待人审 revision，不执行 Steamworks 操作。
tags: [steam, game-publishing, content-survey, age-rating, mature-content, generative-ai, deterministic]
generated: { by: connector:steam-content-survey-revision, at: 2026-08-27T08:55:07.313Z }
verified:
  - { by: probe:steam-content-survey-review-revision-local-20260827, at: 2026-08-27T08:55:07.313Z }
status: stable
stale_after: 2026-09-26T08:55:07.313Z
sources:
  - id: official-survey
    resource: https://partner.steamgames.com/doc/gettingstarted/contentsurvey?language=english
    title: Steam Content Survey
    author: organization:valve
  - id: official-germany-rating
    resource: https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany?language=english
    title: Age Ratings Mandatory in Germany
    author: organization:valve
  - id: local-verification
    resource: ../verifications/steam/content-survey-review-revision/report.json
    title: Steam Content Survey review revision local verification
    author: probe:steam-content-survey-review-revision-local
---

# Steam Content Survey Revision 准备器

工具接受一个调用者实际观察到的 `questionnaireRevisionRef`，以及 General、Mature、Generative AI 三部分的完整问题集合和答案。题目使用 opaque ref；工具不硬编码 Steam 会变化的题目、选项文案或地区分级算法。

每个答案必须绑定内容和证据。成人内容完整披露及当前 build/store 一致性必须显式确认；pre-generated AI 绑定随游戏交付的内容和权利证据，live-generated AI 还绑定运行时内容与 guardrail 证据。相同输入跨时间产生相同 revision hash，任何问题、答案、build、声明或 AI 证据变化都会使旧 revision 失效或直接阻断。

工具不读取 Partner 后台，不判断声明真假，不签发年龄分级，也不改变商店地区可见性。输出固定要求人工审阅，所有平台效果和授权字段均为 false。

- [能力](../capabilities/steam/prepare-content-survey-review-revision.md)
- [Content Survey Review Revision](../concepts/steam/content-survey-review-revision.md)

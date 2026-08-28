---
type: Tool
title: 当前工作投影对账器
description: 对最近持久 Session 的未消费增量执行 owner-bound startup/offline reconciliation，并返回去正文的恢复摘要。
tags: [assistant, current-work, reconciliation, recovery, projection]
generated: { by: connector:current-work-projection-reconciler, at: 2026-08-27T10:42:18.400Z }
verified:
  - { by: probe:current-work-projection-reconciliation-local-20260827, at: 2026-08-27T10:42:18.400Z }
status: experimental
stale_after: 2026-09-26T10:42:18.400Z
sources:
  - id: production-maintainer
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/maintainer.js
    title: Production Knowledge Maintainer
    author: organization:AlexKaiqi
  - id: production-test
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/test/maintainer.test.mjs
    title: Production maintainer tests
    author: organization:AlexKaiqi
  - id: local-verification
    resource: ../verifications/assistant/current-work-projection-reconciliation/report.json
    title: Current-work reconciliation verification
    author: probe:current-work-projection-reconciliation-local
---

# 当前工作投影对账器

外部只需提交当前 Session、owner-bound Workspace 和“长期知识候选保持未确认”的固定边界。内部负责最近 Session 枚举、逐 Session cursor、顺序合并、模型选择和原子本地写入。

结果只报告哪些 opaque Session 得到对账、哪些 checkpoint 推进、哪些 Session 被跳过以及 proposal ref；不返回正文或 cursor。它恢复可观察到的未消费增量，不证明最近 12 个以外的历史完整，也不执行 cursor reset 或全量重建。

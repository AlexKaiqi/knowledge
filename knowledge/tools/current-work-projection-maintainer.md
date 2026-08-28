---
type: Tool
title: 当前工作投影维护器
description: 从 owner-bound 当前 Session 的未消费事件维护可重建 current、推进 checkpoint，并把长期候选隔离为未确认 proposal。
tags: [personal-assistant, current-work, session, agent, checkpoint, proposal]
generated: { by: connector:current-work-projection-maintainer, at: 2026-08-27T06:49:31Z }
verified:
  - { by: probe:current-work-projection-maintenance-local-20260827, at: 2026-08-27T06:49:31Z }
status: experimental
stale_after: 2026-09-26T06:49:31Z
sources:
  - id: production-maintainer
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/maintainer.js
    title: Production current-work maintainer
    author: organization:alex-kaiqi
  - id: production-e2e
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/eval/evidence/latest.md
    title: Personal Knowledge production E2E evidence
    author: project:dsh-personal-knowledge-base
  - id: local-verification
    resource: ../verifications/assistant/current-work-projection-maintenance/report.json
    title: Current work maintenance local verification
    author: probe:current-work-projection-maintenance-local
---

# 当前工作投影维护器

调用者只提交 opaque 当前 Session、opaque Workspace、维护意图以及接受“最多生成四个未确认 proposal”的明确边界。隐藏运行时解析真实 Session/Workspace、读取 cursor 后的增量、选择文本模型并串行执行生产维护逻辑。

该工具会本地写入可重建的 `.pkb/current.md`、`.pkb/cursor.json`，也可能写入 `.pkb/proposals/`；这些都是明确副作用。它不能接收 caller 提交的 transcript、cwd、cursor、模型 route、proposal Markdown、`confirmed` 或授权字段，也不能修改 Session 历史、apply 长期知识或 commit Git。

- [维护当前工作投影](../capabilities/assistant/maintain-current-work-projection.md)
- [Current Work Projection Maintenance](../concepts/assistant/current-work-projection-maintenance.md)

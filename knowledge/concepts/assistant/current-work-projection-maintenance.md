---
type: Concept
title: Current Work Projection Maintenance
description: 从当前 Session 未消费增量更新可重建工作集、推进内部 checkpoint，并把稳定候选停在未确认 proposal 的维护边界。
tags: [personal-assistant, current-work, session, projection, checkpoint, proposal, privacy]
generated: { by: connector:current-work-projection-maintainer, at: 2026-08-27T06:49:31Z }
verified:
  - { by: probe:current-work-projection-maintenance-local-20260827, at: 2026-08-27T06:49:31Z }
status: experimental
stale_after: 2026-09-26T06:49:31Z
sources:
  - id: production-maintainer
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/maintainer.js
    title: Personal Knowledge current-work maintainer
    author: organization:alex-kaiqi
  - id: production-layout
    resource: https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/spec/repository-layout.json
    title: Personal Knowledge repository boundaries
    author: organization:alex-kaiqi
  - id: local-snapshot
    resource: ../../verifications/assistant/current-work-projection-maintenance/snapshot.json
    title: Current work maintenance local snapshot
    author: probe:current-work-projection-maintenance-local
---

# Current Work Projection Maintenance

维护对象是 `.pkb/current.md` 这个可重建工作集，不是 Session 历史或长期知识。隐藏运行时从当前 Session 的未消费 message events 读取增量；模型合并仍在进行的目标、进展、blocker 与下一步；成功后原子替换 current，并推进该 Session 的内部 cursor。

模型识别出的稳定信息最多形成四个未确认 proposal。proposal 文件不是知识事实，也不表示用户批准；只有之后独立的精确内容审阅、真实主人确认、apply 和 Git receipt 才能改变长期知识。

维护结果不返回原始 Session 文本或生成的 current Markdown。`currentProjectionComplete=false` 表示字符预算、模型判断和跨 Session 合并可能遗漏内容；调用者应通过独立读取能力获取投影，并允许用户纠正。

- [维护结果 Schema](../../schemas/assistant/maintain-current-work-projection-output.schema.json)
- [验证样本](../../verifications/assistant/current-work-projection-maintenance/snapshot.json)

---
type: Concept
title: Durable Memory Change Review Revision
description: 将一项持久记忆写入或遗忘与精确目标、base/current/desired 内容摘要、完整内容和 provenance 绑定的待人审对象。
tags: [assistant, durable-memory, content-addressed, proposal, conflict, idempotence, human-review]
generated: { by: connector:durable-memory-change-review-revision, at: 2026-08-27T04:16:30Z }
verified:
  - { by: probe:durable-memory-change-review-revision-local-20260827, at: 2026-08-27T04:16:30Z }
status: stable
stale_after: 2026-09-26T04:16:30Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/assistant/durable-memory-change-review-revision/snapshot.json
    title: Verified durable memory change review revision
    author: connector:durable-memory-change-review-revision
---

# Durable Memory Change Review Revision

`Durable Memory Change Review Revision` 是一次写入或遗忘之前的不可变 handoff。它只允许 `USER.md` 或 `knowledge/` 直属 Markdown 文件，完整保留 normalized content、reason、source/evidence refs，并区分：

- `baseContentDigest`：提案所基于的目标内容；
- `target.contentDigest`：准备审阅时实际观察到的目标内容；
- `desiredContentDigest`：应用后期望得到的内容，删除时为 `null`。

只有 current 与 base 一致且 desired 尚未满足，才产生 `reviewRevisionHash`。current 已等于 desired 时为 `already-satisfied`；current 同时不同于 base 和 desired 时为 `blocked`，调用者必须读取新状态并重新提案，而不是套用旧审阅。

该 revision 不是 Personal Knowledge Base 的内部 proposal ID，也不是确认、Git commit 或 receipt。后续真实 apply 仍必须由可信 Host 将明确用户确认绑定到当前 proposal，并再次检查目标内容。

- [输出 Schema](../../schemas/assistant/prepare-durable-memory-change-review-revision-output.schema.json)
- [验证样本](../../verifications/assistant/durable-memory-change-review-revision/snapshot.json)

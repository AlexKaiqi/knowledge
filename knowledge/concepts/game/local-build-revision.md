---
type: Concept
title: Local Game Build Revision
description: 由游戏构建逐文件摘要、发布意图、来源与权利依据共同标识的本地准备制品；它不是上传、审核或上线回执。
tags: [game, build-revision, artifact-manifest, release-intent, preflight, non-upload]
generated: { by: connector:local-game-build-revision, at: 2026-08-27T02:27:02Z }
verified:
  - { by: probe:local-game-build-revision-local-20260827, at: 2026-08-27T02:27:02Z }
status: stable
stale_after: 2026-09-26T02:27:02Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/game/local-build-revision/snapshot.json
    title: Verified local game build revision
    author: connector:local-game-build-revision
---

# Local Game Build Revision

`Local Game Build Revision` 是交给平台发布 Connector 之前的本地 handoff 对象。它包含稳定排序的 artifact manifest：每项只有相对路径、字节数、SHA-256 和是否入口点；同时记录 target、release lane、visibility intent、source revision 与 rights basis refs。

`revisionHash` 对上述稳定 payload 求摘要，不包含 `preparedAt` 或本机目录，因此同一冻结输入可重放。它标识“这组字节和这次发布意图”，不是不可删除的对象存储；调用者若需以后重现，仍须自行保留相应构建目录或制品仓库。

`status=blocked` 时不生成 revision hash 或 artifact manifest，并列出可机器处理的 blocker。`status=ready` 也不代表 Steam、itch.io、App Store、Google Play 或任何其他渠道已经接受构建，更不代表用户批准了发布。

- [输出 Schema](../../schemas/game/prepare-local-build-revision-output.schema.json)
- [验证样本](../../verifications/game/local-build-revision/snapshot.json)

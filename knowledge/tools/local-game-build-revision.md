---
type: Tool
title: 本地游戏构建 Revision 准备器
description: 对工作区内游戏构建目录做边界与安全预检，以逐文件 SHA-256 清单冻结本地字节和发布意图，但不上传、不签名、不授权执行。
tags: [game, build, release, manifest, sha256, preflight, distribution]
generated: { by: connector:local-game-build-revision, at: 2026-08-27T02:27:02Z }
verified:
  - { by: probe:local-game-build-revision-local-20260827, at: 2026-08-27T02:27:02Z }
status: stable
stale_after: 2026-09-26T02:27:02Z
sources:
  - id: revision-primitive
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/domain.mjs
    title: dsh-social-workbench immutable revision primitive
    author: organization:alex-kaiqi
  - id: media-primitive
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/media.mjs
    title: dsh-social-workbench media fingerprint primitive
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/game/local-build-revision/report.json
    title: Local game build revision verification
    author: probe:local-game-build-revision-local
---

# 本地游戏构建 Revision 准备器

这个本地工具把一个 workspace-relative 游戏构建目录变成可复核的 `Local Game Build Revision`。它递归扫描常规文件，以流式 SHA-256 生成稳定排序的相对路径清单，并把版本、目标、release lane、visibility intent、源码 revision、权利依据和入口点一起纳入 revision hash。

准备器拒绝越界路径、目录或文件 symlink、特殊文件、疑似密钥文件名、缺失入口点、空目录和超预算构建。结果不包含本机绝对路径。相同字节和意图在不同时间重放得到相同 revision hash；任何文件字节或发布意图变化都会形成新 revision。

它不解析压缩包内部，不验证代码签名、公证、病毒扫描、Steam depot 配置、itch channel、Apple bundle 或 Google Play AAB，也不调用任何平台。`status=ready` 只代表本地文件集通过这组窄预检；`uploaded=false` 与 `executionAuthorized=false` 永远成立。

- [准备本地游戏构建 Revision](../capabilities/game/prepare-local-build-revision.md)
- [Local Game Build Revision](../concepts/game/local-build-revision.md)

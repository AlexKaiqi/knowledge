---
type: Capability
title: 准备本地游戏构建 Revision
description: 从工作区构建目录生成逐文件 SHA-256 manifest 和不可变 revision 标识，执行有界安全预检，但不上传或授权平台动作。
tags: [game, build, release-preflight, artifact-manifest, distribution, local]
outcomes: [app-publishing, distribution]
generated: { by: connector:local-game-build-revision, at: 2026-08-27T02:27:02Z }
verified:
  - { by: probe:local-game-build-revision-local-20260827, at: 2026-08-27T02:27:02Z }
status: stable
stale_after: 2026-09-26T02:27:02Z
sources:
  - id: subject
    resource: ../../tools/local-game-build-revision.md
    title: 本地游戏构建 Revision 准备器
    author: tool:local-game-build-revision
  - id: steam-uploading
    resource: https://partner.steamgames.com/doc/sdk/uploading?l=english&language=english
    title: Uploading to Steam
    author: organization:valve
  - id: itch-pushing
    resource: https://itch.io/docs/butler/pushing.html
    title: Pushing builds with butler
    author: organization:itchio
  - id: local-report
    resource: ../../verifications/game/local-build-revision/report.json
    title: Local verification report
    author: probe:local-game-build-revision-local
capability:
  id: game.prepare-local-build-revision
  version: 1.0.0
  subjectRef: /tools/local-game-build-revision.md
  kind: operation
  effect: none
  inputSchema: /schemas/game/prepare-local-build-revision-input.schema.json
  outputSchema: /schemas/game/prepare-local-build-revision-output.schema.json
  resultConcepts: [/concepts/game/local-build-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: optional
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只读取配置的 workspaceRoot 内相对目录；拒绝 symlink、特殊文件和疑似密钥文件名。结果不上传、不签名、不登录平台，也不构成执行授权。
verification:
  level: local
  report: /verifications/game/local-build-revision/report.json
---

# 准备本地游戏构建 Revision

输入声明游戏引用、版本、目标类型、发布 lane、visibility intent、工作区内构建目录、入口点、源码 revision、权利依据与可选 release notes ref。支持的本地文件集类型为 `desktop-portable`、`steam-content-root`、`itch-portable` 和 `web-build`；Web 构建必须包含 `index.html`，portable 构建必须至少声明一个入口点。

Connector 在 canonical workspace 边界内递归枚举常规文件，拒绝 symlink、特殊文件、疑似凭据和超预算输入，并为每个文件流式计算 SHA-256。通过时输出 `ready` revision；阻断时输出固定检查项和 blocker，不返回部分 manifest，避免下游误用未完整冻结的制品。

本地 probe 已对两个真实 fixture 文件核对摘要，证明不同准备时间不会改变 revision hash、单字节变化会改变 revision，并实际阻断 `.env` 与 symlink。它还固定核对生产中的 revision/文件指纹原语。验证没有证明游戏能运行、包内没有恶意内容、签名/公证有效、商店元数据完整、平台审核通过或任何渠道已上传/上线。

- [输入 Schema](../../schemas/game/prepare-local-build-revision-input.schema.json)
- [输出 Schema](../../schemas/game/prepare-local-build-revision-output.schema.json)
- [验证报告](../../verifications/game/local-build-revision/report.json)

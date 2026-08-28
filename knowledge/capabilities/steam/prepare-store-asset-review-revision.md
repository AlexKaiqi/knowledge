---
type: Capability
title: 准备 Steam 商店图像审阅 Revision
description: 按 Steam 当前官方尺寸和数量要求冻结本地 capsule/截图文件集，输出稳定摘要与人工审阅队列，但不执行任何平台写操作。
tags: [steam, game-publishing, store-assets, capsule, screenshot, preflight, local]
outcomes: [app-publishing, distribution]
generated: { by: connector:steam-store-asset-revision, at: 2026-08-27T03:28:39Z }
verified:
  - { by: probe:steam-store-asset-review-revision-local-20260827, at: 2026-08-27T03:28:39Z }
status: stable
stale_after: 2026-09-26T03:28:39Z
sources:
  - id: subject
    resource: ../../tools/steam-store-asset-revision.md
    title: Steam 商店图像 Revision 准备器
    author: tool:steam-store-asset-revision
  - id: required-assets
    resource: https://partner.steamgames.com/doc/store/assets?l=english&language=english
    title: Graphical Assets - Overview
    author: organization:valve
  - id: store-assets
    resource: https://partner.steamgames.com/doc/store/assets/standard?l=english&language=english
    title: Store Graphical Assets
    author: organization:valve
  - id: asset-rules
    resource: https://partner.steamgames.com/doc/store/assets/rules?l=english&language=english
    title: Graphical Asset Rules
    author: organization:valve
  - id: review-process
    resource: https://partner.steamgames.com/doc/store/review_process?l=english&language=english
    title: Review Process
    author: organization:valve
  - id: local-report
    resource: ../../verifications/steam/store-asset-review-revision/report.json
    title: Local verification report
    author: probe:steam-store-asset-review-revision-local
capability:
  id: steam.prepare-store-asset-review-revision
  version: 1.0.0
  subjectRef: /tools/steam-store-asset-revision.md
  kind: operation
  effect: none
  inputSchema: /schemas/steam/prepare-store-asset-review-revision-input.schema.json
  outputSchema: /schemas/steam/prepare-store-asset-review-revision-output.schema.json
  resultConcepts: [/concepts/steam/store-asset-review-revision.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [local-file]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只读配置的 workspaceRoot 内相对文件；Connector 不登录 Steam、不访问 Partner 后台、不上传、不点击 Mark as ready for review、不发布，也不把机器预检解释为人工视觉或权利批准。
verification:
  level: local
  report: /verifications/steam/store-asset-review-revision/report.json
---

# 准备 Steam 商店图像审阅 Revision

输入一个游戏引用、源码 revision、workspace-relative 图像目录、资产分类与权利依据。资产分类只覆盖 Steam 商店页的四种必需 base capsule 和 screenshot；首版不包含 Library、Community、Event、Artwork Override、trailer、商店文案、分级问卷或 build。

Connector 读取 PNG/JPEG 头并流式计算文件摘要。它严格执行当前官方尺寸：Header `920×430`、Small `462×174`、Main `1232×706`、Vertical `748×896`；截图至少五张、至少 `1920×1080` 且精确 16:9。旧 capsule 尺寸被阻断，因为 Steam 当前文档明确说明旧尺寸不再接受。

通过只得到 `ready-for-human-review`。官方同时要求 capsule 有清晰可读的产品名、base capsule 只包含产品 artwork/name/subtitle、图像适龄，截图只展示 gameplay；这些语义不能由尺寸解析证明，因此输出固定保留待人工检查项。Valve 的 `Mark as ready for review` 是另一个 Partner 侧高影响动作，本能力不触达。

本地 probe 生成并读取九个不同的有效 PNG 文件，核对每个真实字节摘要、不同时间稳定重放、旧尺寸、缺失/字节重复截图和 symlink 阻断，并在运行时观察四个 Steam 官方规则页面。它没有证明真实游戏素材已经通过人工视觉/权利审查，也没有证明 Steam 后台上传或审核。

- [输入 Schema](../../schemas/steam/prepare-store-asset-review-revision-input.schema.json)
- [输出 Schema](../../schemas/steam/prepare-store-asset-review-revision-output.schema.json)
- [验证报告](../../verifications/steam/store-asset-review-revision/report.json)

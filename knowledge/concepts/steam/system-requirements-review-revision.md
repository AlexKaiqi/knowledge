---
type: Concept
title: Steam System Requirements Review Revision
description: 内容寻址、按支持 OS 分组并绑定构建与测试证据的系统要求候选，等待配置真实性和发布一致性人审。
tags: [steam, system-requirements, platform-support, revision, human-review]
generated: { by: connector:steam-system-requirements-revision, at: 2026-08-27T07:02:24Z }
verified:
  - { by: probe:steam-system-requirements-review-revision-local-20260827, at: 2026-08-27T07:02:24Z }
status: stable
stale_after: 2026-09-26T07:02:24Z
sources:
  - id: verified-snapshot
    resource: ../../verifications/steam/system-requirements-review-revision/snapshot.json
    title: Verified Steam system requirements review revision
    author: connector:steam-system-requirements-revision
---

# Steam System Requirements Review Revision

Revision 的平台顺序固定为 Windows、macOS、Linux/SteamOS；字段顺序也被规范化，但每个字段的原文和 evidence refs 完整保留。`valueDigest` 便于检测文案漂移，`revisionHash` 还绑定 build revision、artifact、depots、public packages 和 launch tests。

它不是机器认证的硬件兼容报告。引用存在不等于证据真实，启动测试引用存在也不等于 build 已在该 OS 成功启动；最低配置、推荐性能目标、平台 checkbox、depot/package 和默认分支的一致性都保持 pending human review。

准备 Revision 不等于写入、预览、发布、送审、审核通过或上线。

- [输出 Schema](../../schemas/steam/prepare-system-requirements-review-revision-output.schema.json)
- [验证快照](../../verifications/steam/system-requirements-review-revision/snapshot.json)

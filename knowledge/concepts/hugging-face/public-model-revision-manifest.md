---
type: Concept
title: Hugging Face 公共模型 Revision 清单
description: 由 namespace/name 与完整 commit SHA 标识的公开、非 gated 模型仓库分类和有界完整文件清单。
tags: [hugging-face, model-hub, model-repository, revision, manifest, integrity]
generated: { by: connector:hugging-face-public-model-revision, at: 2026-08-26T21:09:16Z }
verified:
  - { by: probe:hugging-face-public-model-revision-live-20260826, at: 2026-08-26T21:09:16Z }
status: stable
stale_after: 2026-09-02T21:09:16Z
sources:
  - id: platform
    resource: ../../platforms/hugging-face-hub.md
    title: Hugging Face Hub
    author: organization:hugging-face
  - id: model-info-api
    resource: https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.model_info
    title: HfApi model_info
    author: organization:hugging-face
  - id: live-snapshot
    resource: ../../verifications/hugging-face/public-model-revision/snapshot.json
    title: Normalized live observation
    author: connector:hugging-face-public-model-revision
---

# Hugging Face 公共模型 Revision 清单

该概念表示一个公开、无需访问审批且未禁用的模型仓库在明确 Git commit 下的最小可验证投影：仓库 ID、commit SHA、pipeline/library 分类、Hub tags，以及 API 返回的完整文件路径、声明大小、Git blob SHA-1 和可用的 LFS SHA-256 或 Xet hash。

`manifestComplete: true` 只对该次官方 `model_info(..., revision=<full commit>, files_metadata=True)` 响应成立，并受 1,024 文件与 4 MiB 响应预算约束；超过预算会失败，不会返回伪完整或截断结果。固定 commit 避免把可移动的 `main` 或 tag 隐藏在能力内部，但仓库仍可能被删除、转私有、加 gate、禁用或重写历史。

Hub tags、pipeline、library 和 `license:*` 都是仓库/模型卡及平台派生元数据，不构成模型质量、安全、许可证或来源审计。清单不包含作者、下载量、点赞、关联 Spaces、widget/card data、请求日志或原始 payload，也不下载或执行任何模型文件。

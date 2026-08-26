---
type: Platform
title: Hugging Face Hub
description: 模型、数据集与 Space 仓库平台；当前只准入了按完整 commit 读取公开非 gated 模型文件清单的能力。
tags: [hugging-face, model-hub, model-repository, public-metadata]
generated: { by: connector:hugging-face-public-model-revision, at: 2026-08-26T21:09:16Z }
verified:
  - { by: probe:hugging-face-public-model-revision-live-20260826, at: 2026-08-26T21:09:16Z }
status: stable
stale_after: 2026-09-02T21:09:16Z
sources:
  - id: hub-api
    resource: https://huggingface.co/docs/hub/api
    title: Hub API Endpoints
    author: organization:hugging-face
  - id: model-info-api
    resource: https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.model_info
    title: HfApi model_info
    author: organization:hugging-face
  - id: repositories
    resource: https://huggingface.co/docs/hub/repositories-getting-started
    title: Getting Started with Repositories
    author: organization:hugging-face
  - id: rate-limits
    resource: https://huggingface.co/docs/hub/rate-limits
    title: Hub Rate limits
    author: organization:hugging-face
  - id: live-report
    resource: ../verifications/hugging-face/public-model-revision/report.json
    title: Public model revision live verification report
    author: probe:hugging-face-public-model-revision-live
---

# Hugging Face Hub

Hugging Face Hub 用 Git revision 管理模型、数据集与 Space 仓库。当前 catalog 只验证了无需身份读取一个公开、非 gated、未禁用模型在明确完整 commit 下的分类和文件清单。

Connector 直接使用官方 Hub API 的匿名访问面，不读取本机 token。它只接收 `namespace/name` 与完整 commit，拒绝可移动 revision，并按官方 5 分钟 RateLimit 窗口返回当前 `api` bucket 状态；遇到 429 只暴露 reset 时间，不立即重试。

已验证输出覆盖完整有界文件路径、大小、Git/LFS/Xet 完整性标识，但不下载或执行模型文件。模型卡 tag 和平台派生字段不能证明许可证、训练数据来源、安全、模型质量、推理兼容性或权重字节已经独立核验。

未验证范围：模型搜索、README/card 读取、文件下载、推理、Inference Provider、数据集、Spaces、私有/gated 仓库、账号、收藏、讨论、上传、删除及其它写操作。

- [读取公共模型 Revision 清单](../capabilities/hugging-face/read-public-model-revision-manifest.md)

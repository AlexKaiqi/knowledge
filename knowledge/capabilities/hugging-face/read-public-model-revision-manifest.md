---
type: Capability
title: 读取 Hugging Face 公共模型 Revision 清单
description: 按 namespace/name 和完整 commit SHA 读取公开非 gated 模型的有界完整文件清单与完整性标识。
tags: [hugging-face, query, public-model, exact-revision, manifest]
outcomes: [product-research]
generated: { by: connector:hugging-face-public-model-revision, at: 2026-08-26T21:09:16Z }
verified:
  - { by: probe:hugging-face-public-model-revision-live-20260826, at: 2026-08-26T21:09:16Z }
status: stable
stale_after: 2026-09-02T21:09:16Z
sources:
  - id: subject
    resource: ../../platforms/hugging-face-hub.md
    title: Hugging Face Hub
    author: organization:hugging-face
  - id: model-info-api
    resource: https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.model_info
    title: HfApi model_info
    author: organization:hugging-face
  - id: rate-limits
    resource: https://huggingface.co/docs/hub/rate-limits
    title: Hub Rate limits
    author: organization:hugging-face
  - id: live-report
    resource: ../../verifications/hugging-face/public-model-revision/report.json
    title: Public model revision live verification report
    author: probe:hugging-face-public-model-revision-live
capability:
  id: hugging-face.public-model.read-revision-manifest
  version: 1.0.0
  subjectRef: /platforms/hugging-face-hub.md
  kind: query
  effect: none
  inputSchema: /schemas/hugging-face/read-public-model-revision-manifest-input.schema.json
  outputSchema: /schemas/hugging-face/read-public-model-revision-manifest-output.schema.json
  resultConcepts: [/concepts/hugging-face/public-model-revision-manifest.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 只读取公开、非 gated、未禁用模型；请求不读取或发送本机 HF token，私有或 gated 仓库必须使用另一项显式授权能力。
verification:
  level: live
  report: /verifications/hugging-face/public-model-revision/report.json
---

# 读取 Hugging Face 公共模型 Revision 清单

输入为精确 `namespace/name` 和完整小写 40 位 `commitSha`。Connector 固定调用 Hugging Face Hub 官方 model revision API，并设置 `blobs=true` 获取文件元数据；拒绝 `main`、tag、缩写 SHA、alternate endpoint、private、gated、disabled、重定向、超过 4 MiB 的响应或超过 1,024 个文件的清单。

输出包含模型任务/library/tags，以及按路径稳定排序的完整清单。每个文件保留声明大小、Git blob SHA-1，并在上游提供时保留 LFS SHA-256 或 Xet hash；同时返回文件清单摘要和官方 `api` bucket 的当前 RateLimit 观测。语义 `resultDigest` 不包含会随请求变化的剩余额度。

能力只读取元数据，不解析 README/model card 正文，不下载权重，不校验远端文件实际字节，不运行推理，也不把 `license:*` tag 当作独立许可证结论。

- [输入 Schema](../../schemas/hugging-face/read-public-model-revision-manifest-input.schema.json)
- [输出 Schema](../../schemas/hugging-face/read-public-model-revision-manifest-output.schema.json)
- [验证报告](../../verifications/hugging-face/public-model-revision/report.json)

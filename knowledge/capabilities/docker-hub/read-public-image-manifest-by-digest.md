---
type: Capability
title: 读取 Docker Hub 公共镜像 Manifest
description: 匿名按 namespace/name 与精确 sha256 digest 读取 OCI/Docker schema 2 image index 或 image manifest 的有界 descriptor surface。
tags: [docker-hub, query, public-image, exact-digest, oci-manifest]
generated: { by: connector:docker-hub-public-image-manifest, at: 2026-08-26T21:30:02Z }
verified:
  - { by: probe:docker-hub-public-image-manifest-live-20260826, at: 2026-08-26T21:30:02Z }
status: stable
stale_after: 2026-09-02T21:30:02Z
sources:
  - id: subject
    resource: ../../platforms/docker-hub.md
    title: Docker Hub
    author: organization:docker
  - id: registry-auth
    resource: https://docs.docker.com/reference/api/registry/auth/
    title: Registry authentication
    author: organization:docker
  - id: registry-manifest-api
    resource: https://distribution.github.io/distribution/spec/api/#pulling-an-image-manifest
    title: Pulling an image manifest
    author: project:distribution
  - id: hub-pull-policy
    resource: https://docs.docker.com/docker-hub/usage/pulls/
    title: Docker Hub pull usage and limits
    author: organization:docker
  - id: live-report
    resource: ../../verifications/docker-hub/public-image-manifest/report.json
    title: Public image manifest live verification report
    author: probe:docker-hub-public-image-manifest-live
capability:
  id: docker-hub.public-image.read-manifest-by-digest
  version: 1.0.0
  subjectRef: /platforms/docker-hub.md
  kind: query
  effect: none
  inputSchema: /schemas/docker-hub/read-public-image-manifest-by-digest-input.schema.json
  outputSchema: /schemas/docker-hub/read-public-image-manifest-by-digest-output.schema.json
  resultConcepts: [/concepts/docker-hub/public-image-manifest.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: Connector 只请求目标公开仓库的匿名 pull-scoped 临时 Bearer token；不读取 Docker credential、不请求 refresh/offline token，也不支持私有仓库。
verification:
  level: live
  report: /verifications/docker-hub/public-image-manifest/report.json
---

# 读取 Docker Hub 公共镜像 Manifest

输入为精确小写 `namespace/name` 和 `sha256:<64 lowercase hex>`。Connector 固定执行一次匿名 token GET 和一次 manifest GET，禁用重定向与重试；拒绝 tag、`latest`、alternate registry、schema 1、OCI artifact、摘要错配、超过 4 MiB 的响应或超过 256 个 descriptor 的 manifest。

输出对原始响应字节独立计算摘要，并保留 manifest 类型、body 大小、descriptor 次序、media type、摘要、声明大小、平台选择字段，以及已识别 Docker attestation → image digest 关系。RateLimit 观测不进入语义 `resultDigest`。

该能力不解析 tag，不下载 config/layer/attestation blob，不执行镜像，也不验证签名、provenance、SBOM、漏洞或许可证。GET manifest 会使用 Docker Hub pull/version-check 预算，429 后不会自动重试。

- [输入 Schema](../../schemas/docker-hub/read-public-image-manifest-by-digest-input.schema.json)
- [输出 Schema](../../schemas/docker-hub/read-public-image-manifest-by-digest-output.schema.json)
- [验证报告](../../verifications/docker-hub/public-image-manifest/report.json)

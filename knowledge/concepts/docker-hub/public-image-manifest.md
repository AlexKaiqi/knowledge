---
type: Concept
title: Docker Hub 公共镜像 Manifest
description: 由仓库名与不可变 sha256 内容摘要标识的 OCI/Docker schema 2 image index 或单平台 image manifest 最小投影。
tags: [docker-hub, oci, image-index, image-manifest, digest, descriptor]
generated: { by: connector:docker-hub-public-image-manifest, at: 2026-08-26T21:30:02Z }
verified:
  - { by: probe:docker-hub-public-image-manifest-live-20260826, at: 2026-08-26T21:30:02Z }
status: stable
stale_after: 2026-09-02T21:30:02Z
sources:
  - id: platform
    resource: ../../platforms/docker-hub.md
    title: Docker Hub
    author: organization:docker
  - id: oci-image-index
    resource: https://github.com/opencontainers/image-spec/blob/v1.1.1/image-index.md
    title: OCI Image Index Specification
    author: organization:opencontainers
  - id: oci-image-manifest
    resource: https://github.com/opencontainers/image-spec/blob/v1.1.1/manifest.md
    title: OCI Image Manifest Specification
    author: organization:opencontainers
  - id: live-snapshot
    resource: ../../verifications/docker-hub/public-image-manifest/snapshot.json
    title: Normalized live observation
    author: connector:docker-hub-public-image-manifest
---

# Docker Hub 公共镜像 Manifest

该概念表示 Docker Hub 公共仓库中一个由 `sha256` 内容摘要固定的 schema 2 manifest。Connector 对响应原始字节独立计算 SHA-256，同时要求 `Docker-Content-Digest` 与请求摘要一致；响应 header 不能替代本地摘要验证。

`image-index` 输出保持 descriptor 原始顺序，因为 OCI 选择规则允许顺序具有语义。它区分可运行平台 manifest、Docker `attestation-manifest` 及未知 descriptor；attestation 只表示上游声明的引用关系，不表示签名或 provenance 已验证。`image-manifest` 输出保持 config 与 layer 栈顺序。

“完整 descriptor surface”只指该 manifest JSON 在 4 MiB、256 descriptors 上限内被完整解析。Connector 不读取 descriptor 指向的 config、layer、attestation payload 或外部 URL，因此不能证明镜像文件、文件系统、构建来源、安全、许可证、可运行性或供应链可信度。tag、annotations、作者、source IP、Bearer token 和 raw payload 不进入产品输出。

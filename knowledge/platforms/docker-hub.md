---
type: Platform
title: Docker Hub
description: 公共容器镜像托管与 Registry 平台；当前只准入了匿名按不可变 sha256 digest 读取 OCI/Docker schema 2 manifest 的能力。
tags: [docker-hub, container-registry, oci, public-metadata]
generated: { by: connector:docker-hub-public-image-manifest, at: 2026-08-26T21:30:02Z }
verified:
  - { by: probe:docker-hub-public-image-manifest-live-20260826, at: 2026-08-26T21:30:02Z }
status: stable
stale_after: 2026-09-02T21:30:02Z
sources:
  - id: registry-auth
    resource: https://docs.docker.com/reference/api/registry/auth/
    title: Registry authentication
    author: organization:docker
  - id: hub-pull-policy
    resource: https://docs.docker.com/docker-hub/usage/pulls/
    title: Docker Hub pull usage and limits
    author: organization:docker
  - id: registry-v2-api
    resource: https://distribution.github.io/distribution/spec/api/
    title: Docker Registry HTTP API V2
    author: project:distribution
  - id: oci-image-spec
    resource: https://github.com/opencontainers/image-spec/tree/v1.1.1
    title: OCI Image Format Specification v1.1.1
    author: organization:opencontainers
  - id: live-report
    resource: ../verifications/docker-hub/public-image-manifest/report.json
    title: Public image manifest live verification report
    author: probe:docker-hub-public-image-manifest-live
---

# Docker Hub

Docker Hub 同时包含产品页面、账号/组织能力和实现 OCI Distribution 协议的容器 Registry。当前 catalog 只验证了无需 Docker ID、按 `namespace/name@sha256:<64 hex>` 读取一个公开镜像的 OCI image index 或 image manifest。

Connector 隐藏匿名 Bearer token exchange 复杂度：它固定从 `auth.docker.io` 请求只含目标仓库 `pull` scope 的短期 token，再固定调用 `registry-1.docker.io` Registry V2 manifest endpoint。token 只存在于单次调用内，不进入输出、日志、Git 或 credential store；不请求 refresh/offline token。

manifest GET 会消耗平台 pull/version-check 预算，因此 Collector 每天最多运行两次，遇到 429 不重试。输出中的 RateLimit 只是该次响应的运行状态；Docker 官方文档中的套餐额度和实际响应窗口可能变化，不能把一次观测推断为所有用户或网络的配额。

未验证范围：tag 解析与 tag 历史、仓库搜索、私有镜像、账号/组织、镜像 push/delete、config/blob/layer 下载、镜像签名与 provenance 验证、SBOM、漏洞扫描、许可证、镜像运行及其它 registry。

- [读取公共镜像 Manifest](../capabilities/docker-hub/read-public-image-manifest-by-digest.md)

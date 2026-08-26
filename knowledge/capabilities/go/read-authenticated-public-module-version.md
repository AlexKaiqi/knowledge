---
type: Capability
title: 读取并认证公共 Go 模块精确版本
description: 通过 Go 官方公共 Module Proxy 与 Checksum Database，读取精确公共模块版本并认证模块文件树和 go.mod 完整性。
tags: [go, module, exact-version, go-mod, checksum, sumdb, integrity]
generated: { by: connector:go-public-module-version, at: 2026-08-26T18:44:39Z }
verified:
  - { by: probe:go-public-module-version-live-20260826, at: 2026-08-26T18:44:39Z }
status: stable
stale_after: 2026-09-02T18:44:39Z
sources:
  - id: subject
    resource: ../../services/go-module-services.md
    title: Go Module Mirror 与 Checksum Database
    author: organization:go-team
  - id: proxy-protocol
    resource: https://go.dev/ref/mod#goproxy-protocol
    title: GOPROXY protocol
    author: organization:go-team
  - id: authentication
    resource: https://go.dev/ref/mod#authenticating
    title: Authenticating modules
    author: organization:go-team
  - id: checksum-database
    resource: https://go.dev/ref/mod#checksum-database
    title: Checksum database
    author: organization:go-team
  - id: privacy
    resource: https://proxy.golang.org/privacy
    title: Privacy · Go modules services
    author: organization:go-team
  - id: live-report
    resource: ../../verifications/go/public-module-version/report.json
    title: Live verification report
    author: probe:go-public-module-version-live
capability:
  id: go.modules.read-authenticated-public-version
  version: 1.0.0
  subjectRef: /services/go-module-services.md
  kind: query
  effect: local-write
  inputSchema: /schemas/go/read-authenticated-public-module-version-input.schema.json
  outputSchema: /schemas/go/read-authenticated-public-module-version-output.schema.json
  resultConcepts: [/concepts/go/authenticated-public-module-version.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api, cli]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只允许调用者已明确确认的公开 module path/version。完整路径和版本会发送给 Google 运行的公共 Go 服务；不得用它探测私有、内部或不确定路径。下载内容仍受项目许可证、作者权利、撤回状态和安全风险约束。
verification:
  level: live
  report: /verifications/go/public-module-version/report.json
---

# 读取并认证公共 Go 模块精确版本

输入只接受 domain-like public module path、精确规范版本，以及固定为 `true` 的 `publicModuleAcknowledged`。Connector 固定使用 `https://proxy.golang.org` 与 `sum.golang.org`，拒绝 latest、branch、range、alternate proxy、direct/VCS fallback、凭据和未确认公开性的路径。归档只允许直接返回，或单次跳转到 `storage.googleapis.com/proxy-golang-org-prod/` 的官方签名 URL；签名 URL 不进入结果。

执行先对精确 `.zip` 做 HEAD 预检，缺失 `Content-Length` 或超过 32 MiB 就失败。随后在全新临时 cache 中用官方 Go command 下载该版本，并强制通过 SumDB 认证模块文件树和 `go.mod`。成功前递归恢复 Go 只读 cache 权限并删除整个 cache；归档只下载、不执行。

输出包含精确身份、`.info` 时间、模块树 h1、`go.mod` 原文/大小/SHA-256/h1、认证方法与 Go verifier 版本、传输/清理结论、ETag、缓存政策和语义摘要。`.info` 时间明确标为 `transport-only`；本地路径、zip、解压源码、原始 SumDB lookup/tiles、credential 和环境配置均被排除。

这个能力可用于 Collector 核验 Go 开源 Connector 的精确 module release 证据。它不求解依赖、不读取 latest、不判断 retraction/license/vulnerability，也不安装、构建或执行模块。模块树 h1 证明与透明日志中已认证记录一致，不证明代码安全、来源仓库仍存在或调用者获得使用授权。

- [输入 Schema](../../schemas/go/read-authenticated-public-module-version-input.schema.json)
- [输出 Schema](../../schemas/go/read-authenticated-public-module-version-output.schema.json)
- [验证报告](../../verifications/go/public-module-version/report.json)

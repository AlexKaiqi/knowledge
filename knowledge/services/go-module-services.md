---
type: Service
title: Go Module Mirror 与 Checksum Database
description: Go 官方团队提供、由 Google 运行的公共模块镜像与可审计 checksum database；当前只准入精确公共模块版本的有界下载与完整性认证。
tags: [go, module, proxy, checksum-database, transparency-log, public-service]
generated: { by: connector:go-public-module-version, at: 2026-08-26T18:36:54Z }
verified:
  - { by: probe:go-public-module-version-live-20260826, at: 2026-08-26T18:36:54Z }
status: stable
stale_after: 2026-09-02T18:36:54Z
sources:
  - id: services
    resource: https://proxy.golang.org/
    title: Go Module Mirror, Index, and Checksum Database
    author: organization:go-team
  - id: module-reference
    resource: https://go.dev/ref/mod
    title: Go Modules Reference
    author: organization:go-team
  - id: privacy
    resource: https://proxy.golang.org/privacy
    title: Privacy · Go modules services
    author: organization:go-team
  - id: live-report
    resource: ../verifications/go/public-module-version/report.json
    title: Authenticated public module version live report
    author: probe:go-public-module-version-live
---

# Go Module Mirror 与 Checksum Database

Go 团队提供 `proxy.golang.org` 公共模块镜像和 `sum.golang.org` checksum database。镜像实现 GOPROXY 协议；checksum database 是带签名树头的透明日志，用于认证公开模块的 `go.sum` 行。当前 catalog 只验证了一个精确公共 module path/version 的读取闭环。

已验证范围：固定 public proxy、固定 public checksum database、模块归档 HEAD 大小检查、精确版本 `.info`、`go.mod` 内容、模块文件树 h1、`go.mod` h1、官方 Go 客户端对签名树与证明的认证，以及临时 cache 清理。归档最多 32 MiB，实际下载但不执行；原始源码、zip、本地 cache 路径和透明日志原始响应不进入结果。

`.info` 的版本时间只受 HTTPS 传输保护，并不在 checksum database 的认证范围内。经认证的是模块文件树和 `go.mod` 内容对应的 h1。删除源仓库或 tag 不保证镜像立即删除已有版本；checksums 可能继续长期保留。

公开服务会收到完整 module path/version。其隐私说明列出请求时间、IP、完整 URL 和技术日志，并说明可识别 IP 日志不保留超过 30 天。因此能力要求调用者显式确认模块路径是公开信息；私有或不确定路径不得调用。

未验证范围：latest/range/branch 解析、版本枚举、模块搜索、依赖图求解、license/retraction/vulnerability 判断、源码审计、构建、安装、执行、私有模块、alternate proxy/SumDB 和写操作。

- [读取并认证公共 Go 模块精确版本](../capabilities/go/read-authenticated-public-module-version.md)

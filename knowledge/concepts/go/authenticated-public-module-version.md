---
type: Concept
title: 经认证的公共 Go 模块精确版本
description: 由精确 module path/version 标识，并由 checksum database 认证模块文件树与 go.mod 内容的有界版本证据。
tags: [go, module-version, go-mod, h1, integrity, authenticated]
generated: { by: connector:go-public-module-version, at: 2026-08-26T18:44:39Z }
verified:
  - { by: probe:go-public-module-version-live-20260826, at: 2026-08-26T18:44:39Z }
status: stable
stale_after: 2026-09-02T18:44:39Z
sources:
  - id: service
    resource: ../../services/go-module-services.md
    title: Go Module Mirror 与 Checksum Database
    author: organization:go-team
  - id: live-snapshot
    resource: ../../verifications/go/public-module-version/snapshot.json
    title: Normalized authenticated module observation
    author: connector:go-public-module-version
---

# 经认证的公共 Go 模块精确版本

该概念是一个精确 Go module path/version 的最小完整性投影。它区分三类事实：未经 checksum database 认证的 `.info` 时间；由 SumDB 认证的模块文件树 h1；由 SumDB 认证且由 Connector 对实际 `go.mod` 内容重新计算匹配的 go.mod h1。

模块文件树 h1 不是 zip 文件字节的普通摘要，而是对归档内文件名与内容形成的确定性目录哈希。go.mod h1 则是把 `go.mod` 作为单文件树计算的 Go `h1:` 摘要。普通 SHA-256 另用于固定本次返回的 `go.mod` 原始字节。

认证由全新隔离 cache 中的官方 Go 客户端完成。它不仅读取 `/lookup`，还验证签名树头、包含证明和一致性证明；裸 `/lookup` 响应不能支撑该概念。归档会被直接读取或经 allowlisted 官方签名存储单跳转下载到临时 cache，以认证模块树，但不会被执行；成功返回前 cache 必须清理，签名 URL 不得保留。

该概念不表示版本是最新、未撤回、安全、合法授权、可构建或适合使用。公开模块确认是调用前置条件，因为完整 module path/version 会发送给 Go 公共服务。

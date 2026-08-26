---
type: Platform
title: crates.io
description: Rust 官方公共 crate registry；当前只准入按注册名和精确版本读取最小化版本元数据与发行物 SHA-256。
tags: [crates-io, rust, cargo, package-registry, public-metadata]
generated: { by: connector:crates-io-public-crate-version, at: 2026-08-26T19:25:43Z }
verified:
  - { by: probe:crates-io-public-crate-version-live-20260826, at: 2026-08-26T19:25:43Z }
status: stable
stale_after: 2026-09-02T19:25:43Z
sources:
  - id: data-access
    resource: https://crates.io/data-access
    title: crates.io Data Access Policy
    author: organization:rust-foundation
  - id: policy-rfc
    resource: https://github.com/rust-lang/rfcs/blob/master/text/3463-crates-io-policy-update.md#data-access
    title: crates.io policy update · Data Access
    author: organization:rust-project
  - id: cargo-manifest
    resource: https://doc.rust-lang.org/cargo/reference/manifest.html#the-package-section
    title: The Cargo Book · Manifest Format
    author: organization:rust-project
  - id: api-version-type
    resource: https://github.com/rust-lang/crates.io/blob/main/crates/crates_io_api_types/src/lib.rs
    title: crates.io API Version response type
    author: organization:rust-project
  - id: live-report
    resource: ../verifications/crates-io/public-crate-version/report.json
    title: Public crate version live verification report
    author: probe:crates-io-public-crate-version-live
---

# crates.io

crates.io 是 Rust/Cargo 的公共 package registry。当前 catalog 只验证了无需账号读取一个明确注册名、明确 semver 的 crate version：固定调用官方 `GET /api/v1/crates/<crate>/<version>`，一次 operation 只产生一次请求。

官方数据政策要求 API 客户端最多每秒一次请求，并发送能唯一识别应用、最好包含联系信息的 User-Agent。Connector 以固定官方 host、带联系 URL 的应用 User-Agent 和进程内最短 1 秒请求闸门落实该政策；大量数据不走这项能力，应改用官方 sparse index 或每日 database dump。

已验证输出包括精确 crate/version、描述、SPDX license expression 声明、最低 Rust 版本、edition、yank 状态、创建/更新时间、库/二进制形态、三类 HTTPS 项目链接，以及 `.crate` 发行物大小、官方 download URL 和 SHA-256。输出有意排除下载量、发布者、头像、审计用户、features、dependencies、任意 API links 和原始 payload。

未验证范围：搜索、版本枚举、latest/range 解析、依赖或 feature 求解、README、crate 下载、checksum 重算、安装、构建、执行、漏洞/许可证审计、账号、发布、yank/unyank 和其它写操作。API 字段是 registry/发布者元数据，不证明源码仓库与发行物一致、安全、可维护或调用者取得许可。

- [读取公共 crate 精确版本元数据](../capabilities/crates-io/read-public-crate-version.md)

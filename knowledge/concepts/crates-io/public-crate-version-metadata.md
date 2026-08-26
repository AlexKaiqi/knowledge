---
type: Concept
title: crates.io 公共 crate 版本元数据
description: crates.io 中由注册 crate name 和精确 semver 标识的有界版本投影及发行物 SHA-256 身份。
tags: [crates-io, rust, crate, version, metadata, integrity]
generated: { by: connector:crates-io-public-crate-version, at: 2026-08-26T19:25:43Z }
verified:
  - { by: probe:crates-io-public-crate-version-live-20260826, at: 2026-08-26T19:25:43Z }
status: stable
stale_after: 2026-09-02T19:25:43Z
sources:
  - id: platform
    resource: ../../platforms/crates-io.md
    title: crates.io
    author: organization:rust-project
  - id: api-version-type
    resource: https://github.com/rust-lang/crates.io/blob/main/crates/crates_io_api_types/src/lib.rs
    title: crates.io API Version response type
    author: organization:rust-project
  - id: live-snapshot
    resource: ../../verifications/crates-io/public-crate-version/snapshot.json
    title: Normalized live observation
    author: connector:crates-io-public-crate-version
---

# crates.io 公共 crate 版本元数据

该概念表示一个精确 crate version 的最小化观测：注册名、semver、描述、license expression、最低 Rust、edition、yank 状态、发行时间、库/二进制形态、安全的项目链接，以及 `.crate` 归档的大小、官方 download URL 与 SHA-256。

精确版本避免把会移动的 latest 或 semver range 藏在调用中，但版本仍可被 yank/unyank，yank message 与 `updated_at` 也可能变化。因此 Collector 同时观察不可忽略的发行摘要和可变治理元数据，变化只生成 proposal。

SHA-256 是 registry 声明的发行物身份；当前能力不下载归档，也没有独立重算。license、rust-version、repository、homepage、documentation 和 description 都是发布/registry 元数据，不构成安全、许可证或源码对应性审计。发布者身份、审计用户、下载量、features、dependencies 和 raw payload 不属于这个最小概念。

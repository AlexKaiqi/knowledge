---
type: Capability
title: 读取 crates.io 公共 crate 精确版本元数据
description: 从固定 crates.io API 读取一个公共 crate 的精确版本，并返回最小化元数据与发行物 SHA-256 身份。
tags: [crates-io, rust, cargo, crate-version, metadata, integrity, official-api]
generated: { by: connector:crates-io-public-crate-version, at: 2026-08-26T19:25:43Z }
verified:
  - { by: probe:crates-io-public-crate-version-live-20260826, at: 2026-08-26T19:25:43Z }
status: stable
stale_after: 2026-09-02T19:25:43Z
sources:
  - id: subject
    resource: ../../platforms/crates-io.md
    title: crates.io
    author: organization:rust-project
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
    resource: ../../verifications/crates-io/public-crate-version/report.json
    title: Live verification report
    author: probe:crates-io-public-crate-version-live
capability:
  id: crates-io.registry.read-public-crate-version
  version: 1.0.0
  subjectRef: /platforms/crates-io.md
  kind: query
  effect: none
  inputSchema: /schemas/crates-io/read-public-crate-version-input.schema.json
  outputSchema: /schemas/crates-io/read-public-crate-version-output.schema.json
  resultConcepts: [/concepts/crates-io/public-crate-version-metadata.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅读取公共 registry 的一个精确版本。必须遵守 crates.io 每秒最多一次请求及可识别 User-Agent 政策；大规模数据应使用官方 index 或 database dump。元数据、链接和发行物仍受平台政策、crate 许可证、作者权利、yank 与删除状态约束。
verification:
  level: live
  report: /verifications/crates-io/public-crate-version/report.json
---

# 读取 crates.io 公共 crate 精确版本元数据

输入只接受 crates.io 注册名的精确拼写和精确 semver。Connector 固定访问 `https://crates.io/api/v1/crates/<crate>/<version>`，不接受 latest、range、alternate registry、重定向或凭据；一次 operation 只请求一次，进程内请求起始间隔至少 1 秒，响应上限为 1 MiB，失败不自动重试。

输出只保留 crate/version、描述、license expression、最低 Rust、edition、yank 状态和原因、创建/更新时间、库/二进制形态、经过过滤的 HTTPS repository/homepage/documentation，以及 `.crate` 大小、固定官方 download URL、SHA-256、观测时间和结果摘要。身份、checksum、download path、时间或有界字段漂移都会失败。

该能力适合核验“某个明确 Rust crate version 在 crates.io 中存在、声明了什么采用约束、registry 声明的发行物身份是什么”。它不下载、重算或执行归档，不解析 features/dependencies，也不证明许可证、安全、维护质量或源码仓库与 `.crate` 一致。

- [输入 Schema](../../schemas/crates-io/read-public-crate-version-input.schema.json)
- [输出 Schema](../../schemas/crates-io/read-public-crate-version-output.schema.json)
- [验证报告](../../verifications/crates-io/public-crate-version/report.json)

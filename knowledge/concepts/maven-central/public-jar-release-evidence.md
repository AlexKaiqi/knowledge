---
type: Concept
title: Maven Central 公共 JAR Release 证据
description: 由精确非 SNAPSHOT GAV 标识，并由实际 POM/JAR 字节、Central SHA-1 sidecar、本地 SHA-256 和未验签 PGP sidecar 构成的有界发布证据。
tags: [maven-central, gav, pom, jar, checksum, signature]
generated: { by: connector:maven-central-public-jar-release, at: 2026-08-26T21:44:25Z }
verified:
  - { by: probe:maven-central-public-jar-release-live-20260826, at: 2026-08-26T21:44:25Z }
status: stable
stale_after: 2026-09-02T21:44:25Z
sources:
  - id: platform
    resource: ../../platforms/maven-central.md
    title: Maven Central
    author: organization:sonatype
  - id: artifacts
    resource: https://maven.apache.org/repositories/artifacts.html
    title: Maven Artifacts
    author: organization:apache-maven
  - id: requirements
    resource: https://central.sonatype.org/publish/requirements/
    title: Central Publishing Requirements
    author: organization:sonatype
  - id: live-snapshot
    resource: ../../verifications/maven-central/public-jar-release/snapshot.json
    title: Normalized live observation
    author: connector:maven-central-public-jar-release
---

# Maven Central 公共 JAR Release 证据

该概念绑定一个 Central repository 内的精确 release GAV 与三个实际文件：POM、无 classifier 主 JAR、JAR detached PGP signature。POM 和 JAR 都完整下载到内存，在 1 MiB/32 MiB 上限内计算 SHA-1/SHA-256；本地 SHA-1 必须同时匹配强制 sidecar 与 Central checksum header。

POM XML 只解析顶层/parent 继承后的 modelVersion、GAV 和 packaging，用来拒绝路径与内容身份漂移；developers、contributors、emails、dependency graph、repositories、build plugins 和 raw XML 不进入结果。`pomCoordinatesVerified` 不表示整个 POM 模型已解析或依赖可解。

`signaturePresent: true` 只表示 `.asc` 是有界 PGP ASCII armor 并有本地 hash；`signatureCryptographicallyVerified: false` 是硬边界。该证据不能证明签名者身份、key 可信、许可证、安全、JAR 内容合理或执行安全。

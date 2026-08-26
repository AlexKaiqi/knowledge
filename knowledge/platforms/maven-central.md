---
type: Platform
title: Maven Central
description: JVM 公共组件仓库；当前只准入了按精确非 SNAPSHOT GAV 下载并核验 POM、主 JAR、强制 SHA-1 sidecar 与 JAR PGP sidecar 的能力。
tags: [maven-central, java, jvm, artifact-repository, public-release]
generated: { by: connector:maven-central-public-jar-release, at: 2026-08-26T21:44:25Z }
verified:
  - { by: probe:maven-central-public-jar-release-live-20260826, at: 2026-08-26T21:44:25Z }
status: stable
stale_after: 2026-09-02T21:44:25Z
sources:
  - id: official-central-url
    resource: https://maven.apache.org/pom.html
    title: POM Reference and default Central repository
    author: organization:apache-maven
  - id: repository-layout
    resource: https://maven.apache.org/repository/layout.html
    title: Maven Repository Layout
    author: organization:apache-maven
  - id: publishing-requirements
    resource: https://central.sonatype.org/publish/requirements/
    title: Central Publishing Requirements
    author: organization:sonatype
  - id: immutability
    resource: https://central.sonatype.org/publish/requirements/immutability/
    title: Immutability of Published Components
    author: organization:sonatype
  - id: live-report
    resource: ../verifications/maven-central/public-jar-release/report.json
    title: Public JAR release live verification report
    author: probe:maven-central-public-jar-release-live
---

# Maven Central

Maven Central 是 Maven 默认的公共组件仓库；当前 Connector 固定使用 Maven 官方声明的 `https://repo.maven.apache.org/maven2`，不接受 mirror、私服或调用者提供的 repository URL。

当前能力只处理精确 `groupId:artifactId:version` 的非 SNAPSHOT、无 classifier 主 JAR。Connector 按官方 repository layout 构造路径，完整下载 POM、POM `.sha1`、主 JAR、JAR `.sha1` 与 JAR `.asc`，验证 POM 的有效 GAV/`jar` packaging，并对 POM/JAR 的本地 SHA-1 与 Central sidecar、`x-checksum-sha1` header 三方核对；同时自行计算 SHA-256。

Central 要求 SHA-1 sidecar，但 SHA-1 不应被当作现代抗碰撞安全证明；本地 SHA-256 只是本次下载字节的稳定身份，不是发布者签署的 SHA-256。PGP sidecar 只验证存在和确定字节，尚未解析 key、信任链或验签。

未验证范围：版本搜索、metadata/latest、SNAPSHOT、classifier、非 JAR packaging、parent/dependency 解析、transitive graph、BOM、插件执行、签名信任、许可证、安全扫描、私有仓库、镜像一致性、发布与其它写操作。

- [读取公共 JAR Release 证据](../capabilities/maven-central/read-public-jar-release-evidence.md)

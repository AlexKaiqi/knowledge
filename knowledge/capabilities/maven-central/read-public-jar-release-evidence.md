---
type: Capability
title: 读取 Maven Central 公共 JAR Release 证据
description: 按精确非 SNAPSHOT GAV 下载并核验 POM、主 JAR、Central SHA-1 sidecar 与未验签的 JAR PGP sidecar。
tags: [maven-central, query, public-jar, exact-version, integrity]
generated: { by: connector:maven-central-public-jar-release, at: 2026-08-26T21:44:25Z }
verified:
  - { by: probe:maven-central-public-jar-release-live-20260826, at: 2026-08-26T21:44:25Z }
status: stable
stale_after: 2026-09-02T21:44:25Z
sources:
  - id: subject
    resource: ../../platforms/maven-central.md
    title: Maven Central
    author: organization:sonatype
  - id: repository-layout
    resource: https://maven.apache.org/repository/layout.html
    title: Maven Repository Layout
    author: organization:apache-maven
  - id: publishing-requirements
    resource: https://central.sonatype.org/publish/requirements/
    title: Central Publishing Requirements
    author: organization:sonatype
  - id: error-policy
    resource: https://central.sonatype.org/faq/403-error-central/
    title: Central download errors and 429 semantics
    author: organization:sonatype
  - id: live-report
    resource: ../../verifications/maven-central/public-jar-release/report.json
    title: Public JAR release live verification report
    author: probe:maven-central-public-jar-release-live
capability:
  id: maven-central.public-jar.read-release-evidence
  version: 1.0.0
  subjectRef: /platforms/maven-central.md
  kind: query
  effect: none
  inputSchema: /schemas/maven-central/read-public-jar-release-evidence-input.schema.json
  outputSchema: /schemas/maven-central/read-public-jar-release-evidence-output.schema.json
  resultConcepts: [/concepts/maven-central/public-jar-release-evidence.md]
  executionCharacteristics:
    determinism: deterministic
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-repository]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 固定匿名读取 Maven Central；不读取 Maven settings、credential、mirror 或本地 ~/.m2，不支持私服和发布。
verification:
  level: live
  report: /verifications/maven-central/public-jar-release/report.json
---

# 读取 Maven Central 公共 JAR Release 证据

输入为精确 `groupId`、`artifactId` 和非 SNAPSHOT `version`。Connector 固定按 Maven repository layout 串行执行五个 GET，不跟随重定向或重试；拒绝 `LATEST`/`RELEASE`/range/SNAPSHOT、alternate repository、非 JAR packaging、坐标漂移、XML entity、checksum 错配、缺失/非 armor 签名以及超限响应。

输出包含有效 GAV、repository path、POM model/坐标核验，以及 POM/JAR/signature 的文件名、固定 URL、大小、本地 SHA-1/SHA-256 和 checksum 来源。POM/JAR 标记 `central-sidecar-verified`；signature 只能标记 `local-only`，并显式声明未完成密码学验签。

能力会下载主 JAR 字节以计算摘要，但不会保存、解压、安装、加载或执行。它不解析依赖、验证许可证/安全，也不能证明另一 Maven mirror 返回相同字节。

- [输入 Schema](../../schemas/maven-central/read-public-jar-release-evidence-input.schema.json)
- [输出 Schema](../../schemas/maven-central/read-public-jar-release-evidence-output.schema.json)
- [验证报告](../../verifications/maven-central/public-jar-release/report.json)

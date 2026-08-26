---
type: Capability
title: 读取公共 OSV 漏洞公告
description: 从固定 OSV API 按精确 ID 读取有界标准漏洞元数据、affected ranges 与 references。
tags: [osv, vulnerability, advisory, official-api]
generated: { by: connector:osv-public-advisory, at: 2026-08-26T19:42:01Z }
verified: [{ by: probe:osv-public-advisory-live-20260826, at: 2026-08-26T19:42:01Z }]
status: stable
stale_after: 2026-09-02T19:42:01Z
sources:
  - { id: subject, resource: ../../sources/osv.md, title: OSV.dev, author: organization:google-open-source-security-team }
  - { id: api, resource: "https://google.github.io/osv.dev/get-v1-vulns/", title: "GET /v1/vulns/{id}", author: organization:google-open-source-security-team }
  - { id: schema, resource: https://ossf.github.io/osv-schema/, title: OSV Schema, author: organization:openssf }
  - { id: report, resource: ../../verifications/osv/public-advisory/report.json, title: Live verification report, author: probe:osv-public-advisory-live }
capability:
  id: osv.read-public-advisory
  version: 1.0.0
  subjectRef: /sources/osv.md
  kind: query
  effect: none
  inputSchema: /schemas/osv/read-public-advisory-input.schema.json
  outputSchema: /schemas/osv/read-public-advisory-output.schema.json
  resultConcepts: [/concepts/osv/public-advisory.md]
  executionCharacteristics: { determinism: mixed, humanReview: none, agentInvolvement: none }
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅查询公开 OSV 记录；各上游数据库可能有不同许可与更正政策。结果不得被当作完整漏洞清单或安全结论。
verification: { level: live, report: /verifications/osv/public-advisory/report.json }
---

# 读取公共 OSV 漏洞公告

输入只接受精确、大小写敏感的 advisory ID。Connector 固定访问 `https://api.osv.dev/v1/vulns/<id>`，不接受 alternate host、查询模式、重定向或凭据；响应上限 2 MiB，错误不重试。

Details 只保留完整正文 hash 和最多 4,096 字符摘要；affected version 超过 256 项时只返回排序样本并明确截断。该能力不能回答“某项目是否安全”，也不替代 OSV-Scanner、依赖解析、环境确认或人工安全审查。

- [输入 Schema](../../schemas/osv/read-public-advisory-input.schema.json)
- [输出 Schema](../../schemas/osv/read-public-advisory-output.schema.json)
- [验证报告](../../verifications/osv/public-advisory/report.json)

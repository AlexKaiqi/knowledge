---
type: Information Source
title: OSV.dev
description: 聚合采用 OSV Schema 的开源漏洞记录；当前只准入按精确 advisory ID 读取有界标准字段。
tags: [osv, vulnerability, open-source, advisory, security]
generated: { by: connector:osv-public-advisory, at: 2026-08-26T19:42:01Z }
verified: [{ by: probe:osv-public-advisory-live-20260826, at: 2026-08-26T19:42:01Z }]
status: stable
stale_after: 2026-09-02T19:42:01Z
sources:
  - { id: api, resource: "https://google.github.io/osv.dev/get-v1-vulns/", title: "GET /v1/vulns/{id}", author: organization:google-open-source-security-team }
  - { id: schema, resource: https://ossf.github.io/osv-schema/, title: Open Source Vulnerability format, author: organization:openssf }
  - { id: data, resource: https://google.github.io/osv.dev/data/, title: OSV data sources, author: organization:google-open-source-security-team }
  - { id: report, resource: ../verifications/osv/public-advisory/report.json, title: Live verification report, author: probe:osv-public-advisory-live }
---

# OSV.dev

OSV.dev 聚合多个采用 OSV Schema 的开源漏洞数据库。当前只验证了无需账号、按大小写敏感的精确 ID 调用官方 `GET /v1/vulns/{id}`。

输出保留标准身份、时间、aliases、摘要、severity、affected package/range/event、HTTPS references，以及有界 details 和版本样本。credits、数据库/生态私有扩展和 raw payload 被剔除。官方 API 当前声明无 rate limit，但 Connector 仍限制单响应 2 MiB、拒绝重定向且不重试。

它只证明 OSV 当前返回了这条记录，不代表漏洞数据库完整、记录正确、目标项目一定受影响或已经安全。版本样本可能截断，调用方必须读取 `sampleComplete`；真正判断依赖是否受影响仍需版本/commit 匹配与环境审查。

- [读取公共 OSV Advisory](../capabilities/osv/read-public-advisory.md)

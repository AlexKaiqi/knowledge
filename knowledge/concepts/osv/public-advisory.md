---
type: Concept
title: OSV 公共漏洞公告
description: 由精确 OSV ID 标识的有界漏洞记录、受影响包与版本边界投影。
tags: [osv, advisory, affected-range, vulnerability]
generated: { by: connector:osv-public-advisory, at: 2026-08-26T19:42:01Z }
verified: [{ by: probe:osv-public-advisory-live-20260826, at: 2026-08-26T19:42:01Z }]
status: stable
stale_after: 2026-09-02T19:42:01Z
sources:
  - { id: source, resource: ../../sources/osv.md, title: OSV.dev, author: organization:google-open-source-security-team }
  - { id: schema, resource: https://ossf.github.io/osv-schema/, title: OSV Schema, author: organization:openssf }
  - { id: snapshot, resource: ../../verifications/osv/public-advisory/snapshot.json, title: Live snapshot, author: connector:osv-public-advisory }
---

# OSV 公共漏洞公告

该概念是精确 OSV ID 的最小化投影。Affected range event 保留 introduced、fixed、last-affected 或 limit 的明确边界；版本清单最多返回 256 个排序样本，同时保存总数、完整性和全列表 SHA-256。

记录可能被修订或撤回，aliases 也不保证不同数据库完全等价。它是已知漏洞证据，不是漏洞扫描结论、利用可行性判断或安全保证。

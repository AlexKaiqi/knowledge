---
type: Capability
title: 读取 PyPI 公共项目精确 Release 元数据
description: 通过 PyPI 官方 JSON API 读取规范化项目名下的精确 release，并返回最小化项目元数据、发行文件完整性和缓存状态。
tags: [pypi, python, package-release, distribution, integrity, official-api]
generated: { by: connector:pypi-public-project-release, at: 2026-08-26T18:15:36Z }
verified:
  - { by: probe:pypi-public-project-release-live-20260826, at: 2026-08-26T18:15:36Z }
status: stable
stale_after: 2026-09-02T18:15:36Z
sources:
  - id: subject
    resource: ../../platforms/pypi.md
    title: Python Package Index (PyPI)
    author: organization:python-packaging-authority
  - id: json-api
    resource: https://docs.pypi.org/api/json/
    title: PyPI JSON API · Get a release
    author: organization:python-packaging-authority
  - id: live-report
    resource: ../../verifications/pypi/public-project-release/report.json
    title: Live verification report
    author: probe:pypi-public-project-release-live
capability:
  id: pypi.projects.read-public-release
  version: 1.0.0
  subjectRef: /platforms/pypi.md
  kind: query
  effect: none
  inputSchema: /schemas/pypi/read-public-project-release-input.schema.json
  outputSchema: /schemas/pypi/read-public-project-release-output.schema.json
  resultConcepts: [/concepts/pypi/public-project-release-metadata.md]
  executionCharacteristics:
    determinism: mixed
    humanReview: none
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 仅读取 PyPI 公共项目的精确 release。元数据和发行文件仍受项目许可证、作者权利、PyPI 政策、yank/删除和安全状态约束；不得把许可证字段、项目链接或完整性摘要当作独立授权或安全结论。
verification:
  level: live
  report: /verifications/pypi/public-project-release/report.json
---

# 读取 PyPI 公共项目精确 Release 元数据

输入只接受规范化小写 PyPI project name 和精确规范化 Python package version。Connector 固定调用官方 `https://pypi.org/pypi/<project>/<version>/json`，不接受 latest/range、alternate API base、重定向或凭据；响应上限为 2 MiB，发行文件上限为 64，HTTP 失败不自动重试。

输出保留最小 release metadata、最多 12 个有用的 HTTPS 项目链接、已知漏洞数量、发行文件清单、SHA-256、BLAKE2b-256、可选 Core Metadata SHA-256、官方文件 URL、ETag、serial、缓存政策、观测时间和语义摘要。个人字段、漏洞详情、长许可证正文、无关链接和原始响应被排除。

项目/版本身份漂移、文件摘要缺失、文件逃逸 `files.pythonhosted.org`、目录式文件名、响应/文件数量超限会失败；ETag 缺失或 header/body serial 不一致会转为 `review-required`。429 只产生带 reset 的 deferred proposal，不会立即重试或误报 Connector 漂移。

这个能力可用于核验 Python 开源项目的精确发行证据，不能下载、安装或执行发行物，也不能证明源码仓库、构建产物、许可证和安全状态彼此一致。

- [输入 Schema](../../schemas/pypi/read-public-project-release-input.schema.json)
- [输出 Schema](../../schemas/pypi/read-public-project-release-output.schema.json)
- [验证报告](../../verifications/pypi/public-project-release/report.json)

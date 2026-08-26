---
type: Platform
title: Python Package Index (PyPI)
description: Python 的公共软件包索引；当前只准入按规范化项目名和精确版本读取最小化 release metadata 与发行文件完整性信息。
tags: [pypi, python, package-index, releases, public-metadata]
generated: { by: connector:pypi-public-project-release, at: 2026-08-26T18:15:36Z }
verified:
  - { by: probe:pypi-public-project-release-live-20260826, at: 2026-08-26T18:15:36Z }
status: stable
stale_after: 2026-09-02T18:15:36Z
sources:
  - id: json-api
    resource: https://docs.pypi.org/api/json/
    title: PyPI JSON API
    author: organization:python-packaging-authority
  - id: api-policies
    resource: https://docs.pypi.org/api/
    title: PyPI API policies
    author: organization:python-packaging-authority
  - id: project-metadata
    resource: https://docs.pypi.org/project_metadata/
    title: PyPI Project Metadata
    author: organization:python-packaging-authority
  - id: core-metadata
    resource: https://packaging.python.org/en/latest/specifications/core-metadata/
    title: Core metadata specifications
    author: organization:python-packaging-authority
  - id: live-report
    resource: ../verifications/pypi/public-project-release/report.json
    title: Public project release live verification report
    author: probe:pypi-public-project-release-live
---

# Python Package Index (PyPI)

PyPI 是 Python 包的公共索引。当前 catalog 只验证了无需账号读取一个公开项目的精确 release：固定使用官方 `GET /pypi/<project>/<version>/json`，项目名必须先按 PyPI 规则规范化，版本必须是精确规范化版本。

已验证范围：项目/版本身份、summary、Requires-Python、License-Expression 或许可证 classifiers、经过筛选的有用 HTTPS 项目链接、yank 状态、已知漏洞数量，以及最多 64 个发行文件的文件名、类型、大小、上传时间、Requires-Python、yank 状态、SHA-256、BLAKE2b-256、Core Metadata SHA-256 和 `files.pythonhosted.org` URL。输出同时保留 ETag、项目 serial 和缓存政策。

未验证范围：项目搜索、版本枚举、latest/range 解析、distribution 下载或执行、依赖求解、安装、安全审计、漏洞详情、私有索引、上传、yank/unyank、账号和所有写操作。PyPI 文档明确说明元数据来自上传值且不一定与文件内容一致；项目 URL 的验证也不代表目标安全或当前仍受项目所有者控制。

License-Expression 和 classifiers 都只是发布元数据。摘要证明发行对象身份，不证明包安全、源码与发行文件一致、许可证文件存在或调用者取得某种使用权。

- [读取公共项目精确 Release 元数据](../capabilities/pypi/read-public-project-release.md)

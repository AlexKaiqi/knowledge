---
type: Concept
title: PyPI 公共项目 Release 元数据
description: PyPI 中由规范化项目名和精确版本标识的最小化 release metadata、发行文件清单与完整性信息。
tags: [pypi, python, project, release, distribution, integrity]
generated: { by: connector:pypi-public-project-release, at: 2026-08-26T18:15:36Z }
verified:
  - { by: probe:pypi-public-project-release-live-20260826, at: 2026-08-26T18:15:36Z }
status: stable
stale_after: 2026-09-02T18:15:36Z
sources:
  - id: platform
    resource: ../../platforms/pypi.md
    title: Python Package Index (PyPI)
    author: organization:python-packaging-authority
  - id: live-snapshot
    resource: ../../verifications/pypi/public-project-release/snapshot.json
    title: Normalized live observation
    author: connector:pypi-public-project-release
---

# PyPI 公共项目 Release 元数据

该概念表示一个精确 PyPI release 的有界投影。Release 层包含规范化/发布项目名、版本、摘要、Python 版本要求、许可证表达式/classifiers、精选项目链接、yank 状态和已知漏洞数量；distribution 层包含发行文件身份、平台信息、大小、上传时间、yank 状态、受信下载域名与三个可能的内容/元数据摘要。

精确版本避免把会移动的 latest 或 version range 隐藏在调用里。项目名同时保存规范化值和发布值，以正确处理大小写、点、下划线与连字符别名，但外部输入只接受规范化小写形式。

JSON API 文档说明 release metadata 来自上传时提供的值，首次上传的数据被保存，后续文件上传不会更新它；yank、删除、漏洞数据和项目状态仍可能变化。Collector 因此比较语义 `resultDigest`、发行文件摘要和状态，并把任何变化提交复审。

作者、维护者、邮箱、完整漏洞详情、长许可证正文、无关捐助链接和原始响应不属于这个产品概念。License、Requires-Python、project URL 与漏洞数量仍是来源声明，不是独立事实审计。

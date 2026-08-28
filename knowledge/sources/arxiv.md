---
type: Information Source
title: arXiv
description: 通过 arXiv 官方 Metadata API 公开检索预印本描述性元数据，用于前沿技术、研究问题和可验证方法发现。
tags: [arxiv, preprints, research, papers, metadata, frontier-technology]
generated: { by: connector:arxiv-public-metadata-search, at: 2026-08-27T03:15:37Z }
verified:
  - { by: probe:arxiv-public-metadata-search-live-20260827, at: 2026-08-27T03:15:37Z }
status: stable
stale_after: 2026-09-03T03:15:37Z
sources:
  - id: api-manual
    resource: https://info.arxiv.org/help/api/user-manual.html
    title: arXiv API User's Manual
    author: organization:arxiv
  - id: api-terms
    resource: https://info.arxiv.org/help/api/tou.html
    title: Terms of Use for arXiv APIs
    author: organization:arxiv
  - id: live-report
    resource: ../verifications/arxiv/public-metadata-search/report.json
    title: arXiv public metadata search live verification
    author: probe:arxiv-public-metadata-search-live
---

# arXiv

arXiv 是研究发现信息源，不是“论文结论为真”的证明。当前准入范围只覆盖官方 legacy Metadata API 的有界 phrase/category 查询，返回标题、摘要、作者、标识符、分类、版本时间以及 arXiv abstract/PDF 链接。

官方条款允许检索、存储、转换和分享描述性元数据，并要求 legacy API 全部机器合计最多每三秒一次、单连接访问。Connector 在进程内串行化请求并固定至少三秒间隔；不下载 PDF、源文件或其它 e-print 内容，也不自动提交论文。

API 使用 offset pagination，结果集会随新提交和版本更新变化。因此 offset 不是稳定 delta checkpoint，`totalResults` 也不能用来证明某个研究方向的真实规模、质量或共识。检索结果必须进入证据化调研，由后续阅读、复现、反证和产品 probe 决定是否采用。

- [搜索公开预印本元数据](../capabilities/arxiv/search-public-eprint-metadata.md)
- [公开预印本元数据页概念](../concepts/arxiv/public-eprint-metadata-page.md)
- [验证报告](../verifications/arxiv/public-metadata-search/report.json)

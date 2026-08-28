---
type: Concept
title: Public arXiv E-print Metadata Page
description: 一个有界、排序明确、offset 分页且结果集可变的 arXiv 描述性元数据页面。
tags: [arxiv, metadata, preprint, offset-page, research-evidence]
generated: { by: connector:arxiv-public-metadata-search, at: 2026-08-27T03:15:37Z }
verified:
  - { by: probe:arxiv-public-metadata-search-live-20260827, at: 2026-08-27T03:15:37Z }
status: stable
stale_after: 2026-09-03T03:15:37Z
sources:
  - id: subject
    resource: ../../sources/arxiv.md
    title: arXiv
    author: organization:arxiv
  - id: api-manual
    resource: https://info.arxiv.org/help/api/user-manual.html
    title: arXiv API User's Manual
    author: organization:arxiv
  - id: live-report
    resource: ../../verifications/arxiv/public-metadata-search/report.json
    title: Live verification report
    author: probe:arxiv-public-metadata-search-live
---

# Public arXiv E-print Metadata Page

每个 entry 保留 arXiv ID、标题、摘要、作者、首次提交/最近更新、primary/secondary category、abstract/PDF 官方链接，以及可选 comment、journal reference、DOI。它们是发现与识别元数据，不等于同行评审、复现成功、研究质量或产品适配结论。

页面声明 `totalResults`、`startIndex`、`itemsPerPage` 和本页返回数。`corpusComplete` 只表示当前请求是否在首个页面覆盖当前结果集；即使为真也不表示未来不会新增或更新。offset 固定不是稳定 delta checkpoint。

- [产品 Schema](../../schemas/arxiv/search-public-eprint-metadata-output.schema.json)
- [验证报告](../../verifications/arxiv/public-metadata-search/report.json)

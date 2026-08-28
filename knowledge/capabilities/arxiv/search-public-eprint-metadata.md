---
type: Capability
title: 搜索 arXiv 公开预印本元数据
description: 通过 arXiv 官方 Metadata API，以有界 phrase/category 查询读取最多 20 条描述性元数据，不下载论文内容文件。
tags: [arxiv, preprints, metadata, technical-research, academic-research, search]
outcomes: [product-research, demand-discovery]
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
  - id: api-terms
    resource: https://info.arxiv.org/help/api/tou.html
    title: Terms of Use for arXiv APIs
    author: organization:arxiv
  - id: live-report
    resource: ../../verifications/arxiv/public-metadata-search/report.json
    title: arXiv public metadata search live verification
    author: probe:arxiv-public-metadata-search-live
capability:
  id: arxiv.search-public-eprint-metadata
  version: 1.0.0
  subjectRef: /sources/arxiv.md
  kind: query
  effect: none
  inputSchema: /schemas/arxiv/search-public-eprint-metadata-input.schema.json
  outputSchema: /schemas/arxiv/search-public-eprint-metadata-output.schema.json
  resultConcepts: [/concepts/arxiv/public-eprint-metadata-page.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [official-api]
  accountRequired: false
  durableRetention: allowed
  authorizationNotes: 仅获取官方条款定义的描述性元数据；遵守所有机器合计每三秒最多一次和单连接限制。不下载/缓存 PDF、源文件，不绕过限流，不代表 arXiv 背书，不执行论文提交。
verification:
  level: live
  report: /verifications/arxiv/public-metadata-search/report.json
---

# 搜索 arXiv 公开预印本元数据

输入是 2–200 字符的纯 phrase、`all|title|abstract` 字段、可选单个 arXiv category、官方排序、0–1000 offset 和最多 20 条结果。Connector 自己构造 arXiv query grammar，不接受任意操作符、endpoint、原始参数或大批量抓取。

输出保留研究发现所需描述性元数据和覆盖边界。它适合为个人助理/宠物、游戏 AI、交互、记忆、评测和反馈方法寻找前沿工作，再把具体 paper 交给证据化调研。它不声称摘要结论正确，不执行全文阅读/复现，也不把 result count 外推为市场需求。

2026-08-27 live probe 对 `personal assistant` + `cs.AI` 按 submitted date 倒序读取 5 条，总结果 153；结果 Schema、顺序、官方链接、metadata-only、无凭据和 offset-not-delta 边界全部通过。未验证其它 category、超出首个小页的长期分页、OAI-PMH/bulk data、citation graph 或论文提交。

- [输入 Schema](../../schemas/arxiv/search-public-eprint-metadata-input.schema.json)
- [输出 Schema](../../schemas/arxiv/search-public-eprint-metadata-output.schema.json)
- [验证报告](../../verifications/arxiv/public-metadata-search/report.json)

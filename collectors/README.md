# Collectors

Collector 持续维护 OKF knowledge 和 Connector，不承担业务 Capability 的普通分页、checkpoint 或数据抓取语义。

```text
collectors/<collector-id>/
├── collector.json   CollectorDefinition
├── projects.json    optional ecosystem project watch catalog
├── sources.json     optional official/authoritative source watch list
├── src/             maintenance controller
├── prompts/         optional agent prompts
└── evals/           agentic maintenance evaluations
```

Collector 默认只生成 knowledge proposal、connector change proposal 或 verification report；合入 canonical knowledge 仍经过准入门。

项目 watch catalog 不是“推荐列表”。它同时保存可采用候选、许可证阻断项目、只供研究的实现和已排除的关键词命中，避免重复调研。确定性 Collector 自动观察 HEAD 与复审周期；需要 release 面时应消费已验证的 Tag Connector，而不是在 Collector 内复制 Git wire 解析。HEAD/tag 漂移或到期后生成 proposal，由审阅流程核验 release、issue、license、archived、能力文档与代码差异。任何变化都不能自动升级依赖、route 或 canonical knowledge。

来源预算也是被观测状态，不是 Connector 漂移。遇到带明确 reset time 的官方限流时，Collector 必须输出 deferred/rerun proposal，禁止立即重试，也不能误报为实现失效；只有非限流访问失败或契约断言失败才生成 Connector change proposal。

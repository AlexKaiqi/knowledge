# Collectors

Collector 持续维护 OKF knowledge 和 Connector，不承担业务 Capability 的普通分页、checkpoint 或数据抓取语义。

```text
collectors/<collector-id>/
├── collector.json   CollectorDefinition
├── src/             maintenance controller
├── prompts/         optional agent prompts
└── evals/           agentic maintenance evaluations
```

Collector 默认只生成 knowledge proposal、connector change proposal 或 verification report；合入 canonical knowledge 仍经过准入门。

# Connectors

每个 Connector 隐藏一项或多项 Capability 的执行复杂度。

```text
connectors/<connector-id>/
├── connector.json   ConnectorDefinition
├── src/             deterministic / agentic / hybrid implementation
└── test/            conformance and failure tests
```

真实候选实现可以以 `conformance.status=candidate` 进入仓库接受 review 和 probe；它不会被 Gateway 路由，也不能支撑 canonical knowledge。只有 `verified` Connector 才能被已准入 Capability 使用。空目录、伪实现和仅有声明的占位仍然禁止。

# Connectors

每个 Connector 隐藏一项或多项 Capability 的执行复杂度。

```text
connectors/<connector-id>/
├── connector.json   ConnectorDefinition
├── src/             deterministic / agentic / hybrid implementation
└── test/            conformance and failure tests
```

只有存在已通过 probe 的真实实现时才创建 Connector 目录，不创建占位实现。

# Connectors

每个 Connector 隐藏一项或多项 Capability 的执行复杂度。

```text
connectors/<connector-id>/
├── connector.json   ConnectorDefinition
├── routes.json      AccessRouteCatalog（可选；多实现、降级与恢复路径）
├── src/             deterministic / agentic / hybrid implementation
└── test/            conformance and failure tests
```

真实候选实现可以以 `conformance.status=candidate` 进入仓库接受 review 和 probe；它不会被 Gateway 路由，也不能支撑 canonical knowledge。只有 `verified` Connector 才能被已准入 Capability 使用。空目录、伪实现和仅有声明的占位仍然禁止。

多路径不等于盲目 fallback。等价自动切换必须同时满足 `verified`、完整 Capability 契约和健康检查；共享同一平台 UI/接口的实现要显式声明共同故障域。平台写入必须在副作用前固定 route，任何 `possibly-executed` 或 `unknown` 结果都先对账，禁止换 route 重发。

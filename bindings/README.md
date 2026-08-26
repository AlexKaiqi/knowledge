# Hidden bindings

这里保存已经通过 probe 的 Capability 到 Connector/Collector 实现版本的隐藏绑定元数据。

- Connector：`connectors/<connector-id>.connector.json`
- Collector：`collectors/<collector-id>.collector.json`
- 实现代码继续属于 `implementation.project` 指向的来源 Git repository。
- 每个绑定必须固定 Git revision、entrypoint、内容 SHA-256 和 conformance report。
- 没有已准入 Capability 时，不创建占位绑定。

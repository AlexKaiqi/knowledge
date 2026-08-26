# Versioned contracts

这些 JSON Schema 是仓库控制面契约，不是已接入对象。

| Schema | 责任 |
| --- | --- |
| `okf-capability-profile.schema.json` | OKF Capability 扩展：Subject、kind、effect、产品 Schema、访问方式与验证引用 |
| `knowledge-admission-policy.schema.json` | canonical knowledge 的机器准入政策 |
| `connector-definition.schema.json` | Capability 到同仓库隐藏执行入口的绑定；支持 deterministic、agentic、hybrid、manual |
| `collector-definition.schema.json` | knowledge/Connector 的维护控制器、trigger、proposal-only 写策略与预算 |
| `probe-definition.schema.json` | 可重复执行的 probe、环境、身份要求、断言、清理与预算 |
| `probe-report.schema.json` | probe 的结果、有效期、检查项、证据哈希和副作用 |
| `probe-identity.schema.json` | 合法测试身份的 opaque 元数据与 credential ref |
| `probe-identity-pool.schema.json` | 身份池选择、并发、冷却、配额和隔离限制 |

规则：

- 所有 schema 使用 JSON Schema Draft 2020-12 和唯一 `$id`。
- `schemaVersion` 不兼容变化必须发布新 major；兼容字段只能 optional add。
- Connector/Collector 的 entrypoint 必须保持在自己的顶层目录内。
- 产品输入输出 Schema 不放在 `spec/`，而放在 `knowledge/schemas/` 并由 Capability 引用。
- secret 字段不允许进入任何 schema；只能出现 credential ref。

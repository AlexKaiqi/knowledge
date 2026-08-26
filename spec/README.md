# Versioned contracts

这些 JSON Schema 是仓库控制面契约，不是已接入对象。

| Schema | 责任 |
| --- | --- |
| `okf-capability-profile.schema.json` | OKF Capability 扩展：Subject、kind、effect、产品 Schema、访问方式与验证引用 |
| `knowledge-admission-policy.schema.json` | canonical knowledge 的机器准入政策 |
| `connector-definition.schema.json` | Capability 到同仓库隐藏执行入口的绑定；支持 candidate/verified/suspended/retired conformance 与 deterministic、agentic、hybrid、manual 执行 |
| `access-route-catalog.schema.json` | 同一 Subject/Capability 的完整、降级、恢复与组件接入路径；记录故障域、覆盖缺口、维护来源和安全切换策略 |
| `source-watch-list.schema.json` | Collector 维护的官方/权威来源、已审阅文档指纹、静态或浏览器渲染观测方式与关键语义断言 |
| `ecosystem-project-catalog.schema.json` | 开源生态项目的能力信号、许可证、实现机制、共同故障域、研究缺口与持续复审策略；项目被发现不等于可作为依赖或自动路由 |
| `collector-definition.schema.json` | knowledge/Connector 的维护控制器、trigger、proposal-only 写策略与预算 |
| `probe-definition.schema.json` | 可重复执行的 probe、环境、身份要求、断言、清理与预算 |
| `probe-report.schema.json` | probe 的结果、有效期、检查项、证据哈希和副作用 |
| `probe-identity.schema.json` | 合法测试身份的 opaque 元数据与 credential ref |
| `probe-identity-pool.schema.json` | 身份池选择、并发、冷却、配额和隔离限制 |

规则：

- 所有 schema 使用 JSON Schema Draft 2020-12 和唯一 `$id`。
- `schemaVersion` 不兼容变化必须发布新 major；兼容字段只能 optional add。
- Connector/Collector 的 entrypoint 必须保持在自己的顶层目录内。
- `candidate` Connector 可以接受审查和真实 probe，但不能被 canonical Capability 路由；只有带通过报告的 `verified` Connector 可以准入。
- 自动路由只能选择 `verified + full + healthy` 路径；研究、候选、降级和恢复路径只用于维护、显式交接或后续验证。
- 平台写入一旦可能已执行或结果未知，不得自动切换路径重试；必须先用原路径或人工恢复路径完成 reconcile。
- 产品输入输出 Schema 不放在 `spec/`，而放在 `knowledge/schemas/` 并由 Capability 引用。
- secret 字段不允许进入任何 schema；只能出现 credential ref。

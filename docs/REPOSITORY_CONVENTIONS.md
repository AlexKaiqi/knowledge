# Repository conventions

## 1. 四个事实面

```text
knowledge/   外部语义与调用契约
connectors/  业务能力执行
collectors/  知识与执行维护
probes/      可用性的主动证明
```

四者共享一个 Git revision，但只有 `knowledge/` 对普通消费者公开。任何运行时索引、搜索库或 UI 都是这个 Git 事实源的派生投影。

## 2. 路径与 ID

- 路径使用小写 kebab-case；稳定路径就是稳定 Concept ID。
- Platform：`/platforms/<platform>.md`
- Tool：`/tools/<tool>.md`
- Source：`/sources/<source>.md`
- Concept：`/concepts/<domain>/<concept>.md`
- Capability：`/capabilities/<namespace>/<capability>.md`
- 产品 Schema：`/schemas/<namespace>/<name>.schema.json`
- Verification：`/verifications/<namespace>/<capability>/<report-id>.json`
- Connector：`connectors/<connector-id>/connector.json`
- Collector：`collectors/<collector-id>/collector.json`

`/` 开头的引用都相对 `knowledge/` bundle root。Connector/Collector entrypoint 则相对 repository root。

## 3. 公开 Capability

Capability frontmatter 至少包括：

```yaml
type: Capability
status: stable
stale_after: <RFC3339>
sources: [...]
verified: [...]
capability:
  id: <stable-id>
  version: <semver>
  subjectRef: /platforms/example.md
  kind: query
  effect: none
  inputSchema: /schemas/example/query.input.schema.json
  outputSchema: /schemas/example/query.output.schema.json
access:
  class: authorized
  methods: [official-api]
  accountRequired: true
  durableRetention: restricted
verification:
  level: sandbox
  report: /verifications/example/query/<report>.json
```

产品差异全部留在 input/output Schema；不要为了统一目录而统一业务 payload。

## 4. 隐藏实现

- Connector 可以实现多个紧密相关 Capability，但每个 handler 都必须显式绑定 `capabilityRef`。
- `candidate` Connector 是可运行、可测试但尚未通过真实 probe 的候选实现；它可以进入 Git 接受审查，但不会进入运行时路由或公开 knowledge。`verified` 才代表可用。
- Agent 只能实现已发布契约，不能在运行时扩张 effect 或 Schema。
- Collector 默认 `proposal-only`；对 knowledge、Connector、identity、credential 或 live probe 的改变必须经过 gate。
- 普通调用结果不返回 Connector ID、Collector ID、provider route、prompt 或 credential ref。

## 5. 版本与删除

- 兼容实现变化只更新 Connector version、probe report 和 Git revision。
- Capability 语义或输入输出不兼容时发布新 Capability version/path。
- 过期或失败能力从当前可用投影移除，但历史 Verification 和 Git history 不删除。

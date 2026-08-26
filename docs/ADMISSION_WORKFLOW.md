# Admission workflow

一次只处理一个真实 Capability：

```text
选择 Subject + Capability
  → 在 .staging/ 准备候选知识与 Schema
  → 实现并本地验证 candidate Connector
  → 定义 ProbeDefinition
  → 选择合法 identity / pool
  → 在 local / sandbox / production-public / production-private 执行
  → 清理副作用并生成 ProbeReport
  → 脱敏报告发布到 knowledge/verifications/
  → 运行确定性校验与 Connector conformance tests
  → Git review
  → 合入 knowledge/
```

准入必须同时满足：

1. Subject 有可核验来源、状态和 freshness。
2. Capability 有稳定 ID/version、访问方式、授权要求和 effect。
3. 输入输出 Schema 能独立编译。
4. Connector 真实存在，入口可加载，handler 显式绑定 Capability。
5. Probe 可重复，有断言、预算和必要清理。
6. Report 为 `passed`、未过期，证据哈希匹配。
7. Platform/Source/Dataset/Service/Protocol 至少达到 sandbox 或 live 等级。
8. 相关 Concept 都从已准入 Capability 可达；无孤立知识。

失败、partial、过期、仅文档调研、仅 mock 测试或仅安装成功都不算完整可用闭环。

`candidate` Connector 可以作为非空、可测试的实现进入 Git；它仍然不会被 Gateway 路由，也不能让对应 Subject/Capability 进入 canonical `knowledge/`。真实 probe 通过并发布 VerificationReport 后，才将其 conformance 切换为 `verified`。

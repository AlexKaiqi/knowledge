---
type: Policy
title: DSH knowledge admission policy
description: 只有直接服务产品与影响力闭环、并通过可重复 probe 的能力及其可达知识才进入 canonical OKF bundle。
tags: [governance, admission, verification]
generated: { by: human:dsh-maintainer, at: 2026-08-26T00:00:00Z }
verified:
  - { by: human:dsh-maintainer, at: 2026-08-26T00:00:00Z }
status: stable
stale_after: 2026-11-26T00:00:00Z
sources:
  - id: machine-policy
    resource: ../references/admission-policy.json
    title: Machine-readable admission policy
    author: team:dsh
---

# 准入规则

1. Capability 必须声明至少一个产品结果域：需求发现、产品研究、内容发布、App 发布、分发、反馈收集或影响力测量。
2. 平台、工具、信息源、数据集、服务或协议必须至少被一项已通过 probe 的 Capability 引用。
3. Platform、Information Source、Dataset、Service、Protocol 至少需要 sandbox 或 live 级验证；纯本地 Tool 可以用 local 级验证。
4. Capability 必须声明输入/输出 schema、访问方式、外部可见副作用以及新鲜的 probe report。
5. Concept 只有在被已准入 Capability 的输入或结果引用时才进入 canonical bundle。
6. 通用开发基础设施若只是 Collector 的内部手段、且模型或现有工具已经能可靠使用，不建立公共 Subject/Capability。
7. 文档调研、理论能力、仅登记 provider、失败或过期 probe 都只属于候选区，不进入 `knowledge/`。
8. 一次 Git 变更只提升一个 subject 的一组紧密相关能力；Git commit 与内容哈希共同固定版本。
9. Connector 和 Collector 是隐藏实现。Collector 默认只生成 proposal/report，不直接改写 canonical bundle 或 Connector。
10. probe 身份必须是用户/组织所有、provider sandbox、synthetic test 或合同授权身份。不得批量伪造身份、冒充第三方或规避平台风控。

候选内容保存在被 Git 忽略的 `.staging/`，通过验证和评审后才以普通 Git diff 合入。

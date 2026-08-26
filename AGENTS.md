# Knowledge repository rules

本项目是普通独立 Git repository，不属于 `dsh-plugins`，也不是插件。`knowledge/`、`connectors/`、`collectors/` 和 `probes/` 在同一 Git revision 中共同形成可验证闭环。

## 公共与隐藏边界

- `knowledge/` 是外部唯一可感知的 OKF 门面。
- `connectors/` 是隐藏执行逻辑；可以 deterministic、agentic、hybrid 或 manual。
- `collectors/` 是隐藏维护逻辑；负责知识与 Connector 的发现、检查、proposal 和验证，不是分页采集的同义词。
- `probes/` 保存定义和无秘密控制面；脱敏验证结论进入 `knowledge/verifications/`。
- Connector、Collector、prompt、route、credential ref 和内部 trace 不得泄漏到普通 Capability 结果。

## 准入

- live/sandbox 可验证只是必要条件，不是价值证明。新增知识必须直接服务 `docs/PRODUCT_SCOPE.md` 定义的需求发现、产品研究、内容/App 发布、分发、反馈或影响力结果域。
- 模型或现有工具已经能可靠完成的通用开发基础设施操作，最多作为隐藏 Collector 手段；不要为包、镜像、制品、依赖或漏洞元数据建立公共百科。
- 一次变更只准入一个 Capability 及其最小必要 Subject、Concept、Schema、Connector 和 Verification。
- 没有真实执行、新鲜通过报告和可核验来源的 Capability 不得进入 canonical `knowledge/`。
- Platform、Information Source、Dataset、Service、Protocol 至少需要 sandbox 或 live probe。
- 非空、可测试的 Connector 候选允许以 `conformance.status=candidate` 进入仓库；它不能被公开路由，也不能支撑 canonical knowledge。通过 live/sandbox probe 后才切换为 `verified`。
- 候选 knowledge、报告和失败对象留在被 Git 忽略的 `.staging/`；经过本地契约测试的非空 Connector 候选按上一条规则管理。不要创建空占位目录。

## 身份与安全

- probe identity 只允许 opaque ID、credential ref、授权依据、用途、生命周期、配额和隔离策略。
- 用户名、邮箱、Cookie、token、密钥和实际运营身份清单不得进入 Git。
- 不得伪造身份、冒充第三方、规避风控或违反服务条款。

## 验证

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm run check
```

# Knowledge Catalog 仓库指南

本仓库是普通的独立 Git repository，不属于 `dsh-plugins`，不是插件、npm 产品包或 Connector 运行时。它只保存对外可感知、已经通过准入的 OKF 知识与相应的公共契约。

## 边界

- `knowledge/` 是 canonical OKF bundle。
- `spec/` 保存 Capability、Connector、Collector、probe 和身份控制面的版本化 schema。
- `scripts/` 只负责确定性校验，不作为公开知识或已接入能力统计。
- Connector/Collector 的实现属于各提供方项目；`bindings/` 只保存固定来源项目、Git revision、入口和内容哈希的隐藏绑定定义及验证报告引用。
- 研究资料、理论能力和失败/过期 probe 留在 `.knowledge-staging/` 或来源项目，不进入 canonical bundle。
- 一次准入变更只处理一个平台、工具或信息源的一组紧密相关能力。

## 事实与安全

- 没有真实执行实现、新鲜通过报告和可核验来源的 Capability 不得进入 `knowledge/`。
- Platform、Information Source、Dataset、Service、Protocol 至少需要 sandbox 或 live probe。
- probe 身份只记录 opaque ID 与 credential ref；用户名、邮箱、Cookie、token、密钥及运营身份清单不得进入 Git。
- 不得创建或维护用于冒充、批量伪造身份、规避风控或违反服务条款的身份池。

## 验证

使用 Node 24：

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm run check
```

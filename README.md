# DSH Knowledge

DSH 对外知识的独立 Git repository。它直接采用 [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)，保存平台、工具、信息源、Concept、Capability、Schema、访问方式和验证证据。

## 产品边界

外部接入者只读取：

```text
OKF Subject / Concept / Capability / Schema
```

执行和维护复杂度隐藏在来源项目中：

```text
Capability → hidden Connector → Result
Collector → proposal / verification report → Git review → OKF update
```

本仓库不保存账号秘密、Cookie、token、内部 route、Agent prompt 或运营身份清单。

## 当前状态

```text
完整可用闭环：0
已准入 Subject：0
已准入 Capability：0
```

内部 validator 不计入接入对象。抖音、小红书等来源项目中已有的代码、测试或本地装配，必须分别完成真实 probe 后才能逐个进入这里。

## 目录

```text
knowledge/       canonical OKF bundle
bindings/        隐藏 Connector/Collector 的版本化绑定元数据，不包含实现代码
spec/            公共与控制面 JSON Schema
scripts/         确定性准入校验
test/            正向和负向契约测试
docs/            架构与决策
.knowledge-staging/  被 Git 忽略的候选区
```

## 准入一个对象

1. 选择一个平台、工具或信息源的一项真实能力。
2. 在来源项目实现隐藏 Connector，并固定来源 Git revision、入口和内容哈希。
3. 使用合法、授权且隔离的 probe 身份运行真实能力。
4. 保存不含秘密的 ProbeDefinition、通过报告和证据哈希。
5. 编写最小 Subject、Capability 和产品 Schema。
6. 运行 `npm run check`。
7. 以单一对象、可评审的 Git diff 合入。

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm install
npm run check
```

详细设计见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

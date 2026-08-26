# 可执行知识目录

`knowledge/` 是本仓库的 OKF v0.2 公共门面。外部调用者只读取知识、能力、Schema、访问方式和验证状态；同仓库的 Connector、Collector、probe 身份与凭据控制面不属于公共知识面。

## 导航

- [平台](platforms/index.md)
- [服务](services/index.md)
- [工具](tools/index.md)
- [信息源与数据源](sources/index.md)
- [概念](concepts/index.md)
- [能力](capabilities/index.md)
- [产品 Schema](schemas/index.md)
- [政策](policies/index.md)
- [验证](verifications/index.md)
- [参考资料](references/index.md)
- [知识变更历史](log.md)

当前已有 11 个通过真实 probe 的能力：搜索 GitHub 公共仓库、读取 GitHub 公共仓库有界 tag 集合、按不可变 revision 读取 GitHub 公共仓库文件、读取 npm 公共包精确版本元数据、读取 PyPI 公共项目精确 release 元数据、读取 crates.io 公共 crate 精确版本元数据、读取并认证公共 Go 模块精确版本、读取抖音开放平台官方能力接口面、读取小红书账号开放平台 API 接口面、读取浏览器渲染的社区公约接口面，以及通过自有账号会话读取本人笔记列表。GitHub 私有/写能力和 release 对象、npm/PyPI/crates.io 发布、Go 模块执行、抖音业务操作、小红书笔记发布等其它能力仍未通过真实闭环，不进入这里。

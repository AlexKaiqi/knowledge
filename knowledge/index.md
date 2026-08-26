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

当前已有 17 个通过真实 probe 的能力：读取公共 OSV 漏洞公告、搜索 GitHub 公共仓库、读取 GitHub 公共仓库有界 tag 集合、按精确 tag 读取 GitHub 公共仓库 release、按不可变 revision 读取 GitHub 公共仓库文件、读取 Hugging Face 公共模型精确 revision 清单、按不可变 digest 读取 Docker Hub 公共镜像 manifest、读取 Maven Central 公共 JAR 精确 release 证据、读取 npm 公共包精确版本元数据、读取 PyPI 公共项目精确 release 元数据、读取 crates.io 公共 crate 精确版本元数据、读取并认证公共 Go 模块精确版本、读取抖音开放平台官方能力接口面、按 VideoID 读取抖音公开视频嵌入描述、读取小红书账号开放平台 API 接口面、读取浏览器渲染的社区公约接口面，以及通过自有账号会话读取本人笔记列表。其它 GitHub 私有/写能力、Hugging Face 下载/推理/写能力、Docker Hub tag/镜像下载/写能力、Maven 依赖解析/验签/发布、npm/PyPI/crates.io 发布、Go 模块执行、抖音搜索/创作者/写操作、小红书笔记发布等能力仍未通过真实闭环，不进入这里。

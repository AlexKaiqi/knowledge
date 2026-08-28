# bounded-work-context-projection

隐藏适配器。把调用方的 opaque Session/Workspace 引用映射到当前工作投影服务，验证其返回的 query-time projection、来源和预算，再输出不含真实 cwd、仓库 revision、内部 route 或 transcript 的公共结果。

Connector 不维护 `.pkb/current.md`，不读取未授权 Session，不写长期知识，也不授权或执行任何动作。生产投影服务、Session Query 和 Workspace resolver 由运行时注入。
